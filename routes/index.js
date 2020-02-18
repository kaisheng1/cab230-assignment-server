const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

router.get('/', (req, res) => {
	res.send('Welcome to the Queensland Criminal Records API');
});

//-----------------------------------------GET-------------------------------------------------------------
router.get('/offences', async (req, res) => {
	try {
		const rows = await req.db.from('offence_columns').select('pretty');
		res.status(200).json({ offences: rows.map((row) => row.pretty) });
	} catch (err) {
		res.json({ message: 'Database error' });
	}
});

router.get('/areas', async (req, res) => {
	try {
		const rows = await req.db.from('areas').select('area');
		res.status(200).json({ areas: rows.map((row) => row.area) });
	} catch (err) {
		res.json({ message: 'Database error' });
	}
});

router.get('/area/:council', async (req, res) => {
	if (!req.params.council) {
		res.status(400).json({ message: 'missing council' });
	}

	try {
		const rows = await req.db.from('areas').select('lat', 'lng').where('area', req.params.council);
		res.status(200).json({ [req.params.council]: rows[0] });
	} catch (err) {
		res.json({ message: 'Database error' });
	}
});

router.get('/years', async (req, res) => {
	try {
		const rows = await req.db.from('offences').distinct('year');
		res.status(200).json({ years: rows.map((row) => row.year) });
	} catch (err) {
		res.json({ message: 'Database error' });
	}
});

router.get('/genders', async (req, res) => {
	try {
		const rows = await req.db.from('offences').distinct('gender');
		res.status(200).json({ genders: rows.map((row) => row.gender) });
	} catch (err) {
		res.json({ message: 'Database error' });
	}
});

router.get('/ages', async (req, res) => {
	try {
		const rows = await req.db.from('offences').distinct('age');
		res.status(200).json({ ages: rows.map((row) => row.age) });
	} catch (err) {
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
			} else {
				next();
			}
		});
	} else {
		res.status(401).json({ message: 'your authorization token is missing' });
	}
};

router.get('/search?', verifyToken, async (req, res) => {
	if (!req.query.offence) {
		res.status(400).json({ message: 'missing offence query' });
	}

	//database logic
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

	//database logic
	const filter = (baseSearch) => {
		const { offence, ...filter } = req.query;

		return Object.keys(filter).reduce((acc, curr) => {
			if (Array.isArray(filter[curr])) {
				return acc.whereIn(`offences.${curr}`, filter[curr]);
			} else {
				return acc.where(`offences.${curr}`, filter[curr]);
			}
		}, baseSearch);
	};

	try {
		const offence = await req.db
			.select('offence_columns.column')
			.from('offence_columns')
			.where('offence_columns.pretty', req.query.offence);
		const result = await filter(searchOffence(offence[0].column));
		res.status(200).json({ query: req.db.query, result });
	} catch (err) {
		res.status(400).json({ message: 'invalid query' });
	}
});

//-----------------------------------------AUTHENTICATION-------------------------------------------------------------
router.post('/register', (req, res) => {
	if (!req.body.email || !req.body.password) {
		res.status(400).json({ message: `Invalid email or password` });
	} else {
		const user = {
			email: req.body.email,
			password: bcrypt.hashSync(req.body.password, 12)
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
	} else {
		const user = {
			email: req.body.email,
			password: req.body.password
		};

		req
			.db('users')
			.where({ email: user.email })
			.then((result) => {
				if (result.length == 0) throw new Error('Wrong email or password');
				if (!bcrypt.compareSync(user.password, result[0].password)) {
					throw new Error('Invalid password');
				}

				//give json web token
				jwt.sign({ user }, 'secretkey', { expiresIn: '86400' }, (err, token) => {
					if (err) throw new Error('failed to assign JWT');
					res.status(201).json({
						token: token,
						access_token: token,
						token_type: 'Bearer',
						expires_in: '24h'
					});
				});
			})
			.catch((error) => {
				res.status(400).json({ message: error.message });
			});
	}
});

module.exports = router;
