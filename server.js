const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('Uncaught exception: 😥😥😥. Server is shutting down');
  console.log(`Error: ${err.name} and Info: ${err.message}`);
  process.exit(1);
});

dotenv.config({
  path: './config.env',
});

const app = require('./app');

const port = process.env.APP_PORT;
const DB = process.env.DB_LINK;

// connecting with mongodb database
mongoose
  .connect(DB, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then((con) => {
    console.log('Database connection is successfull 😀');
  });

const server = app.listen(port, () => {
  console.log(`App is running on 😀 http://localhost:${port}`);
});

process.on('unhandledRejection', (err) => {
  console.log(
    'Unhandled promise rejection 😥. Server is shutting down imiditely.'
  );
  console.log(`Error: ${err.name} and Info: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});
