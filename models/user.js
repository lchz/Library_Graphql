const { default: mongoose } = require("mongoose");
const mongooseUniqueValidator = require("mongoose-unique-validator");


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3
    },
    favoriteGenre: {
        type: String,
        required: true,
    }
})

userSchema.plugin(mongooseUniqueValidator)

module.exports = mongoose.model('User', userSchema)