const { GraphQLError } = require("graphql")
const Book = require("./models/book")
const Author = require("./models/author")
const User = require("./models/user")
const jwt = require('jsonwebtoken')


const resolvers = {
  
    Query: {
      bookCount: async () => Book.collection.countDocuments(),
  
      authorCount: async () => Author.collection.countDocuments(),
  
      findBooksByTitle: async (root, args) => {
          console.log('Title searching:', args.title)
          const bookList = await Book.find({title: args.title})
          console.log('Result:', bookList)

          return bookList
      },

      allBooks: async (root, args) => {
        if (args.title) {
          console.log('Title searching:', args.title)

          const bookList = await Book.find({}).populate('author')
          const result = bookList.filter(b => b.title.toLowerCase().includes(args.title.toLowerCase()))
          console.log('Result:', result)

          return result
        }
        if (args.authorName && args.genre) {
          const authorOb = await Author.findOne({name: args.authorName})
  
          return await Book.find({
            author: authorOb._id,
            genres: args.genre
          }).populate('author')
        }
  
        if (args.authorName && !args.genre) {
          const authorOb = await Author.findOne({name: args.authorName})
          const res = await Book.find({author: authorOb._id})
          // return res.populate('author')
          return res
        }
  
        if (!args.authorName && args.genre) {
          console.log('genre:', args.genre)
          if (args.genre === 'all') {
            return await Book.find({}).populate('author')
          }
          return await Book.find({
                                  genres: args.genre
                                }).populate('author')
        }
  
        console.log('Find all books')
        return Book.find({}).populate('author')
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
          return res.populate('author')
  
        } catch(error) {
            console.log('Failed book:', newBook)
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
          // {expiresIn: 20}
        )
  
        console.log('Logged in as user:', user.username)
        return {value: token}
  
      },

      deleteBook: async (root, args, context) => {
        // console.log('delete user:', context.currentUser)
        if (!context.currentUser) {
            throw new GraphQLError('Not authenticated', {
              extensions: {
                code: 'BAD_USER_INPUT'
              }
            })
        }

        try {
            deletingBook = await Book.findOne({title: args.title})

            if (deletingBook) {
                await Book.deleteOne({title: args.title})
                console.log('Deleted book:', deletingBook)

                const author = await Author.findOne({_id: deletingBook.author})
                const alls = await resolvers.Query.allAuthors()
                const theauthor = alls.filter(a => a.name===author.name)[0]

                if (theauthor.bookCount === 0) {
                  await Author.deleteOne({_id: theauthor._id})
                }
                return deletingBook
            }

            else {
                throw new GraphQLError('Book not existed', {
                    extensions: {
                        code: 'BAD_USER_INPUT'
                    }
                })
            } 

        } catch (error) {
            throw new GraphQLError('Deleting book failed', {
                extensions: {
                    code: 'BAD_USER_INPUT',
                    invalidArgs: args.title,
                    error
                }
            })
        }

      },

    }
  }
  
module.exports = resolvers