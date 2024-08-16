const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const taskSchema = new Schema({
  task: String,
  description: String,
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
})

module.exports.Task = mongoose.model('Task', taskSchema);