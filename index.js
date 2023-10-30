const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { default: mongoose } = require('mongoose')
const { v1: uuid } = require('uuid')
const { GraphQLError } = require("graphql")


const Book = require('./models/book')
const Author = require('./models/author')

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

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(authorName: String, genre: String): [Book]!
    allAuthors: [Author]!
  }
  type Mutation {
    addBook(
      title: String!
      authorName: String!
      published: Int!
      genres: [String!]!
    ): Book!

    editAuthor(name: String!, setBornTo: Int!): Author
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
              "bookCount": {$size: "$bookList"}
            }
          },
        ]
      )

      return res
    },

  },

  Mutation: {
    addBook: async (root, args) => {
      // If new author, save author to the system
      let findAuthor = await Author.findOne({name: args.authorName})

      if (!findAuthor) {
        const newAuthor = new Author( {name: args.authorName})

        try {
          findAuthor = await newAuthor.save()
          console.log('Add new author:', findAuthor)

        } catch {
          throw new GraphQLError('Author name is too short', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.authorName
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

      } catch {
        throw new GraphQLError('Book title is too short', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.title
          }
        })
      }

    },

    editAuthor: (root, args) => {
      let findAuthor = authors.find(a => a.name === args.name)
      if (!findAuthor) {
        return null
      }

      findAuthor = {
        ...findAuthor,
        born: args.setBornTo
      }
      
      authors = authors.map(a => a.name === args.name ? findAuthor : a)
      return findAuthor
    },


  }
}



const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {listen: { port: 4000 },})
    .then(({ url }) => {
        console.log(`Server ready at ${url}`)
    })