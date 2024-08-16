const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  tasks: [{
    type: Schema.Types.ObjectId,
    ref: 'Task'
  }],
  teams: [{
    type: Schema.Types.ObjectId,
    ref: 'Team'
  }]
});

userSchema.plugin(passportLocalMongoose);
module.exports.User = mongoose.model('User', userSchema);