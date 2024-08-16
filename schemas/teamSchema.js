const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const teamSchema = new Schema({
  name: String,
  uniqueId: String,
  members: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    unique: false
  }],
  leader: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  tasks: [{
    type: Schema.Types.ObjectId,
    ref: 'Task'
  }]
});

module.exports.Team = mongoose.model('Team', teamSchema);