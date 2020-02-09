console.log(process.env.DB_HOST);

module.exports = {
	client: 'mysql',
	connection: {
		host: process.env.DB_HOST,
		database: 'web_computing',
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD
	}
};
