const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('morgan');
const knex = require('knex')(require('./knexfile.js'));

const startServer = () => {
	const app = express();

	//middleware functions
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	app.use(helmet());
	app.use(cors());
	app.use(logger('common'));
	app.use((req, res, next) => {
		req.db = knex;
		next();
	});

	//routes
	app.use('/', require('./routes/index'));

	//listening on port
	const port = process.env.PORT || 4000;
	app.listen(port, () => console.log(`Listening on port ${port}`));
};

startServer();
