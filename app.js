const express = require('express');
const AppError = require('./utils/appError');
const catchAsync = require('./utils/catchAsync');

const app = express();

// alias all routes. If there is no match on any routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
