const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({

    title: {

        type: String,
        require: true,
        minlength: 1,
        trim: true
    },

    _listId: {

        type: mongoose.Types.ObjectId,
        require: true
    },
    completed: {
        type: Boolean,
        default: false
    }
})

const Task = mongoose.model('Task', TaskSchema);

module.exports = { Task }

