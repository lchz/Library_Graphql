const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { default: mongoose } = require('mongoose')
const { v1: uuid } = require('uuid')
const { GraphQLError } = require("graphql")


const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

const jwt = require('jsonwebtoken')

// let authors = [
//   {
//     name: 'Robert Martin',
//     id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
//     born: 1952,
//   },
//   {
//     name: 'Martin Fowler',
//     id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
//     born: 1963
//   },
//   {
//     name: 'Fyodor Dostoevsky',
//     id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
//     born: 1821
//   },
//   { 
//     name: 'Joshua Kerievsky', // birthyear not known
//     id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
//   },
//   { 
//     name: 'Sandi Metz', // birthyear not known
//     id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
//   },
// ]

// let books = [
//   {
//     title: 'Clean Code',
//     published: 2008,
//     author: 'Robert Martin',
//     id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring']
//   },
//   {
//     title: 'Agile software development',
//     published: 2002,
//     author: 'Robert Martin',
//     id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
//     genres: ['agile', 'patterns', 'design']
//   },
//   {
//     title: 'Refactoring, edition 2',
//     published: 2018,
//     author: 'Martin Fowler',
//     id: "afa5de00-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring']
//   },
//   {
//     title: 'Refactoring to patterns',
//     published: 2008,
//     author: 'Joshua Kerievsky',
//     id: "afa5de01-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring', 'patterns']
//   },  
//   {
//     title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
//     published: 2012,
//     author: 'Sandi Metz',
//     id: "afa5de02-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring', 'design']
//   },
//   {
//     title: 'Crime and punishment',
//     published: 1866,
//     author: 'Fyodor Dostoevsky',
//     id: "afa5de03-344d-11e9-a414-719c6709cf3e",
//     genres: ['classic', 'crime']
//   },
//   {
//     title: 'The Demon ',
//     published: 1872,
//     author: 'Fyodor Dostoevsky',
//     id: "afa5de04-344d-11e9-a414-719c6709cf3e",
//     genres: ['classic', 'revolution']
//   },
// ]


require('dotenv').config()

// MongoDB connection
mongoose.set('strictQuery', false)
const MONGODB_URI = process.env.MONGODB_URI
console.log('Connecting to MongoDB')
mongoose.connect(MONGODB_URI)
        .then(() => {console.log('Connected to MongoDB successfully')})
        .catch((error) => {console.log('Error connection to MongoDB:', error.message)})


const typeDefs = `
  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String]!
    id: ID!
  }
  type Author {
    name: String!
    born: Int 
    bookCount: Int
    id: ID!
  }
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }
  
  type Token {
    value: String!
    username: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(authorName: String, genre: String): [Book]!
    allAuthors: [Author]!
    me: User
  }
  type Mutation {
    addBook(
      title: String!
      authorName: String!
      published: Int!
      genres: [String!]!
    ): Book!

    editAuthor(name: String!, setBornTo: Int!): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User
    
    login(
      username: String!
      password: String!
    ): Token

  }
`

const resolvers = {
  Book: {
    author: async (root) => { // root is a Book object
      const authorOb = await Author.findOne({_id: root.author})
      // console.log('autherOb:', authorOb)
      return {
        id: authorOb._id,
        name: authorOb.name,
        born: authorOb.born
      }
    },
  },

  Query: {
    bookCount: async () => Book.collection.countDocuments(),

    authorCount: async () => Author.collection.countDocuments(),

    allBooks: async (root, args) => {
      if (args.authorName && args.genre) {
        const authorOb = await Author.findOne({name: args.authorName})

        return await Book.find({
          author: authorOb._id,
          genres: args.genre
        })
      }
      if (args.authorName && !args.genre) {
        const authorOb = await Author.findOne({name: args.authorName})
        const res = await Book.find({author: authorOb._id})
        return res
      }
      if (!args.authorName && args.genre) {
        return await Book.find({
                                genres: args.genre
                              })
      }
      console.log('Find all books')
      return Book.find({})
    },

    allAuthors: async () => {
      const res = await Author.aggregate(
        [
          {
            $lookup: {
              from: "books",
              localField: "_id",
              foreignField: "author",
              as: "bookList"
            }
          },
          {
            $project: {
              "name": "$name",
              "born": "$born",
              "bookCount": {$size: "$bookList"},
              "id": "$_id"
            }
          },
        ]
      )
      // console.log('allauthors:', res)
      return res
    },

    me: async (root, args, context ) => {
      return context.currentUser
    }

  },

  Mutation: {
    addBook: async (root, args, context) => {
      // Check login information
      const currentUser = context.currentUser
      console.log('args:', args)
      if (!currentUser) {
        console.log('no current:', context.currentUser)

        throw new GraphQLError('Not authenticated', {
          extensions: 'BAD_USER_INPUT'
        })
      }

      // If new author, save author to the system
      let findAuthor = await Author.findOne({name: args.authorName})

      if (!findAuthor) {
        const newAuthor = new Author( {name: args.authorName})

        try {
          findAuthor = await newAuthor.save()
          console.log('Add new author:', findAuthor)

        } catch(error) {
          throw new GraphQLError('Adding new author failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.authorName,
              error
            }
          })
        }
        
      }

      const newBook = new Book( {
        title: args.title,
        published: args.published,
        genres: args.genres,
        author: findAuthor._id,
      })

      try {
        const res = await newBook.save()
        console.log('Saved new book:', res)
        return res

      } catch(error) {
          throw new GraphQLError('Adding new book failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.title,
              error
            }
          })
      }

    },

    editAuthor: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError('Not authenticated', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }

      try {
        const author = await Author.findOne({name: args.name})
        author.born = args.setBornTo
        return await author.save()

      } catch (error) {
        throw new GraphQLError('Editing author failed', {
                                extensions: {
                                  code: 'BAD_USER_INPUT',
                                  invalidArgs: args.name,
                                  error,
                                }
                              })
      }

    },

    createUser: async (root, args) => {
      const user = new User({
        username: args.username, 
        favoriteGenre: args.favoriteGenre
      })

      return user.save()
                  .catch(error => {
                    throw new GraphQLError('Creating new user failed', {
                      extensions: {
                        code: 'BAD_USER_INPUT',
                        invalidArgs: args.username,
                        error
                      }
                    })
                  })
    },

    login: async (root, args) => {
      const user = await User.findOne({username: args.username})

      if (!user || args.password != 'secret') {
        console.log('Login failed for user:', user, 'and pswd:', args.password)
        throw new GraphQLError('Wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      }

      // Token expires in 60*60 seconds, i.e. in one hour.
      const token = jwt.sign(
        userForToken, 
        process.env.JWT_SECRET,
        {expiresIn: 60*60}
      )

      console.log('Logged in as user:', user.username)

      return {value: token, username: user.username}

    },
  }
}


const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },

  context: async ({req, res}) => {
    const auth = req ? req.headers.authorization : null

    if (auth && auth.startsWith('Bearer ')) {
      const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET)
      const currentUser = await User.findById(decodedToken.id)
      return {currentUser}
    }

  },
})
.then(({ url }) => {
    console.log(`Server ready at ${url}`)
})