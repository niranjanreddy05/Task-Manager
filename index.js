const express = require('express');
const app = express();
const ejsMate = require('ejs-mate');
const path = require('path');
const { Task } = require('./schemas/taskSchema.js');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const session = require('express-session');
const CustomError = require('./utils/CustomError.js');
const ExpressError = require('../YelpCamp/utils/ExpressError.js');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const { User } = require('./schemas/userSchema.js');
const flash = require('connect-flash');
const { Team } = require('./schemas/teamSchema.js');

mongoose.connect("mongodb://localhost:27017/task-manager")
  .then(() => {
    console.log("connected to db")
  })
  .catch((e) => {
    console.log(e)
  })

app.use(session({
  secret: 'thisshouldbeabettersecret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}))

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('images'))
app.engine('ejs', ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(flash());


const wrapAsync = (fn) => {
  return function (req, res, next) {
    fn(req, res, next).catch((e) => next(e));
  }
}

const isLoggedIn = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    req.flash('error', 'You must be logged in first!')
    res.redirect('/login')
  }
}

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentUser = req.user;
  next();
})

app.get('/tasks/new', isLoggedIn, (req, res) => {
  res.render('new.ejs')
})

app.get('/tasks/index', isLoggedIn, wrapAsync(async (req, res) => {
  const { username } = req.user;
  const user = await User.findOne({ username }).populate('tasks');
  res.render('index.ejs', { tasks: user.tasks });
}))

app.post('/tasks/new', isLoggedIn, wrapAsync(async (req, res) => {
  const { username } = req.user;
  const user = await User.findOne({ username });
  const data = req.body;
  const task = new Task(data);
  user.tasks.push(task);
  await task.save();
  await user.save();
  res.redirect(303, '/tasks/index');
}))

app.put('/tasks/:id/edit', wrapAsync(async (req, res) => {
  const { id } = req.params;
  const result = await Task.findByIdAndUpdate(id, req.body);
  res.redirect(303, '/tasks/index')
}))

app.delete('/tasks/:id/delete', isLoggedIn, wrapAsync(async (req, res) => {
  const { username } = req.user;
  const { id } = req.params;
  const user = await User.findOne({ username });
  const tasks = user.tasks;
  const newTasks = tasks.filter(task => task.toString() !== id);
  user.tasks = newTasks;
  await Task.findByIdAndDelete(id);
  await user.save();
  res.redirect('/tasks/index')
}))

app.get('/login', (req, res) => {
  res.render('login.ejs')
})

app.get('/register', (req, res) => {
  res.render('register.ejs')
})

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const user = new User({ username, email });
  const hashedUser = await User.register(user, password);
  req.login(hashedUser, (err) => {
    if (err) {
      return next(err);
    }
    req.flash('success', 'Successfully registered!')
    res.redirect('/tasks/index')
  })
})

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), wrapAsync(async (req, res) => {
  req.flash('success', 'Successfully Logged In!');
  res.redirect('/tasks/index');
}))

app.get('/logout', (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect('/login');
  });
})

app.get('/teams', isLoggedIn, wrapAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate('teams');
  console.log(user);
  res.render('teams/teams.ejs', { user });
}))

app.get('/createTeam', isLoggedIn, (req, res) => {
  res.render('teams/createTeam')
})

app.get('/joinTeam', isLoggedIn, (req, res) => {
  res.render('teams/joinTeam')
})

app.post('/createTeam', isLoggedIn, wrapAsync(async (req, res) => {
  const { uniqueId, name } = req.body;
  const leader = req.user.id;
  const uniqueIds = await Team.find({ uniqueId });
  if (uniqueIds.length !== 0) {
    req.flash('error', 'Team already exists. Please choose a different id');
    return res.redirect('/createTeam');
  }
  const team = new Team({ uniqueId, name, leader });
  const user = req.user._id;
  team.members.push(user);
  const updatedUser = await User.findById(req.user._id);
  updatedUser.teams.push(team);
  await updatedUser.save();
  await team.save();
  res.redirect(`/teamIndex/${uniqueId}`);
}))

app.get('/teamIndex/:id', isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  console.log(id)
  const team = await Team.findOne({ uniqueId: id }).populate({
    path: 'tasks',
    populate: {
      path: 'owner'
    }
  }).populate('members').populate('leader');
  console.log(team)
  const tasks = team.tasks;
  console.log(team.members);
  res.render('teams/teamIndex', { tasks, id, team })
}));

app.post('/teams/:id/tasks', isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { task, description } = req.body;
  const owner = req.user.id;
  const newTask = new Task({ task, description, owner });
  const team = await Team.findOne({ uniqueId: id });
  team.tasks.push(newTask);
  await newTask.save();
  await team.save();
  res.redirect(`/teamIndex/${id}`);
}))

app.post('/joinTeam', isLoggedIn, wrapAsync(async (req, res) => {
  const { uniqueId } = req.body;
  const team = await Team.findOne({ uniqueId });
  if(!team) {
    req.flash('error', 'Team does not exist');
    return res.redirect('/joinTeam');
  }
  const members = team.members;
  const foundUser = members.find(member => member.toString() === req.user._id.toString());
  if(foundUser){
    return res.redirect(`/teamIndex/${uniqueId}`);
  }
  const user = req.user;
  team.members.push(user);
  const updatedUser = await User.findById(req.user._id);
  updatedUser.teams.push(team);
  await updatedUser.save();
  await team.save();
  res.redirect(`/teamIndex/${uniqueId}`);
}))

//route for team leaving
app.delete('/teams/:id/leave', wrapAsync(async(req, res) => {
  const { id } = req.params;
  const team = await Team.findOne({ uniqueId: id });
  const userId = req.user._id;
  const user = await User.findById(userId).populate('teams');
  const updatedUsers = team.members.filter(member => member.toString() !== req.user._id.toString());
  team.members = updatedUsers;
  const updatedTeams = user.teams.filter(team => team.uniqueId !== id);
  user.teams = updatedTeams;
  await team.save();
  await user.save();
  res.redirect('/teams');
}))

app.all('*', (req, res) => {
  console.log(req.originalUrl)
  throw new ExpressError('Page Not Found', 404);
})

app.use((err, req, res, next) => {
  const { statusCode = 500, message = 'Something went wrong!' } = err;
  res.render('error.ejs', { statusCode, message, err });
})

app.listen(3000, console.log('Listening at port 3000'))