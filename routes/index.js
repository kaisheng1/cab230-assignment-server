const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
	res.send('Welcome to the Queensland Criminal Records API');
});

//-----------------------------------------GET-------------------------------------------------------------
router.get('/offences', async (req, res) => {
	try {
		const rows = await req.db.from('offence_columns').select('pretty');
		res.json({ offences: rows.map((row) => row.pretty) });
	} catch (err) {
		console.log(err);
		res.json({ message: 'Database error' });
	}
});

router.get('/areas', async (req, res) => {
	try {
		const rows = await req.db.from('areas').select('area');
		res.json({ areas: rows.map((row) => row.area) });
	} catch (err) {
		console.log(err);
		res.json({ message: 'Database error' });
	}
});

router.get('/years', async (req, res) => {
	try {
		const rows = await req.db.from('offences').distinct('year');
		res.json({ years: rows.map((row) => row.year) });
	} catch (err) {
		console.log(err);
		res.json({ message: 'Database error' });
	}
});

router.get('/genders', async (req, res) => {
	try {
		const rows = await req.db.from('offences').distinct('gender');
		res.json({ genders: rows.map((row) => row.gender) });
	} catch (err) {
		console.log(err);
		res.json({ message: 'Database error' });
	}
});

router.get('/ages', async (req, res) => {
	try {
		const rows = await req.db.from('offences').distinct('age');
		res.json({ ages: rows.map((row) => row.age) });
	} catch (err) {
		console.log(err);
		res.json({ message: 'Database error' });
	}
});

//------------------------------------GET only when JWT is verified--------------------------------------
const verifyToken = (req, res, next) => {
	const bearerHeader = req.headers['authorization'];

	if (typeof bearerHeader !== 'undefined') {
		const bearer = bearerHeader.split(' ');
		const bearerToken = bearer[1];
		req.token = bearerToken;
		jwt.verify(req.token, 'secretkey', (err, authData) => {
			if (err) {
				res.status(401).json({ message: 'your token is not authorized' });
			}
		});
		next();
	} else {
		res.status(401).json({ message: 'your authorization token is missing' });
	}
};

router.get('/search?', verifyToken, async (req, res) => {
	if (!req.query.offence) {
		res.status(400).json({ message: 'missing offence query' });
	}
	const searchOffence = (offence) => {
		const total = `offences.${offence} as total`;
		const lga = 'areas.area as LGA';
		return req.db
			.from('areas')
			.select(lga)
			.sum(total)
			.leftJoin('offences', 'offences.area', 'areas.area')
			.groupBy('areas.area');
	};

	try {
		const offence = await req.db
			.select('offence_columns.column')
			.from('offence_columns')
			.where('offence_columns.pretty', req.query.offence);
		const result = await searchOffence(offence[0].column);
		res.json({ query: req.db.query, result });
	} catch (err) {
		console.log(err);
		res.status(400).json({ message: 'invalid query' });
	}
});

//-----------------------------------------AUTHENTICATION-------------------------------------------------------------
router.post('/register', (req, res) => {
	if (!req.body.email || !req.body.password) {
		res.status(400).json({ message: `Invalid email or password` });
		console.log(`Error on request body:`, JSON.stringify(req.body));
	} else {
		const user = {
			email: req.body.email,
			password: req.body.password
		};
		req
			.db('users')
			.insert({ ...user })
			.then((_) => {
				res.status(201).json({ message: 'You successfully registered' });
			})
			.catch((error) => {
				res.status(400).json({ message: 'User already exists' });
			});
	}
});

router.post('/login', (req, res) => {
	if (!req.body.email || !req.body.password) {
		res.status(400).json({ message: `Invalid email or password` });
		console.log(`Error on request body:`, JSON.stringify(req.body));
	} else {
		const user = {
			email: req.body.email,
			password: req.body.password
		};

		req
			.db('users')
			.where({ ...user })
			.then((result) => {
				if (result.length == 0) throw new Error('Wrong email or password');

				//give json web token
				jwt.sign({ user }, 'secretkey', { expiresIn: '86400' }, (err, token) => {
					if (err) throw new Error('failed to assign JWT');
					res.status(201).json({
						token: token,
						access_token: token,
						token_type: 'Bearer',
						expires_in: '86400'
					});
				});
			})
			.catch((error) => {
				res.status(400).json({ message: error.message });
			});
	}
});

module.exports = router;
