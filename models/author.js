const { default: mongoose } = require("mongoose");
const mongooseUniqueValidator = require("mongoose-unique-validator");


const authorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        minlength: 3
    },
    born: {
        type: Number
    }
})

authorSchema.plugin(mongooseUniqueValidator)

module.exports = mongoose.model('Author', authorSchema)