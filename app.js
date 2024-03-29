import express from "express";
import cors from "cors";
import pg from "pg";
import joi from "joi";
import dayjs from "dayjs";
const { Pool } = pg;

const connection = new Pool({
  user: "bootcamp_role",
  password: "senha_super_hiper_ultra_secreta_do_role_do_bootcamp",
  host: "localhost",
  port: 5432,
  database: "boardcamp",
});

// -------------- VALIDATION FUNCTIONS --------------
const inputIsEmpty = (input) => {
  if (!input || input === "") return true;
  return false;
};

const nameIsNotAvailable = async (name, table) => {
  const query = await connection.query(`SELECT * FROM ${table}`);
  return query.rows.some((elem) => elem.name === name);
};

const gameObjIsInvalid = async (game) => {
  let categoryIsValid = false;
  const category = parseInt(game.categoryId);
  const gameSchema = joi.object({
    name: joi.string().min(3).required(),
    image: joi.string().uri(),
    categoryId: joi.number().integer().min(0),
    stockTotal: joi.number().integer().min(0),
    pricePerDay: joi.number().integer().min(0),
  });
  const query = await connection.query("SELECT * FROM categories");
  query.rows.forEach((elem) => {
    if (elem.id === category) categoryIsValid = true;
  });

  const { error } = gameSchema.validate(game);
  if (error || !categoryIsValid) return true;
  else return false;
};

const customerObjIsInvalid = async (customer) => {
  const customerSchema = joi.object({
    name: joi.string().min(3).required(),
    phone: joi
      .string()
      .min(10)
      .max(11)
      .pattern(/[0-9]{10,11}/),
    cpf: joi
      .string()
      .min(11)
      .max(11)
      .pattern(/[0-9]{11}/),
    birthday: joi
      .string()
      .min(10)
      .max(10)
      .pattern(/[0-9]{4}-[0-9]{2}-[0-9]{2}/),
  });
  const { error } = customerSchema.validate(customer);
  return error;
};

const cpfIsNotAvailable = async (cpf) => {
  let userUsingCpf = false;
  const query = await connection.query(`SELECT * FROM customers`);
  query.rows.forEach((elem) => {
    if (elem.cpf === cpf) {
      userUsingCpf = elem;
    }
  });
  return userUsingCpf;
};

const customerIdExist = async (id) => {
  const query = await connection.query("SELECT * FROM customers");
  return query.rows.some((elem) => elem.id === id);
};

const gameIdExist = async (id) => {
  const query = await connection.query("SELECT * FROM games");
  return query.rows.some((elem) => elem.id === id);
};

const gameIsAvailable = async (gameId) => {
  let openRentals = 0;
  const rentals = await connection.query("SELECT * FROM rentals");
  rentals.rows.forEach((rental) => {
    if (rental.gameId === gameId && rental.returnDate === null) openRentals++;
  });

  const game = await connection.query(
    `SELECT * FROM games WHERE games.id = $1`,
    [gameId]
  );
  if (game.rows[0].stockTotal > openRentals) return true;
  return false;
};

const rentalIdIsInvalid = async (id) => {
  const query = await connection.query(
    `SELECT * FROM rentals WHERE rentals.id = $1`,
    [id]
  );
  if (query.rowCount === 0) return true;
  return false;
};

const rentalIsFinished = async (id) => {
  const query = await connection.query(
    `SELECT * FROM rentals WHERE rentals.id = $1`,
    [id]
  );
  if (query.rows[0].returnDate !== null) return true;
  return false;
};
// //

// -------------------- CREATE SERVER --------------
const app = express();
app.use(express.json());
app.use(cors());

// --------------------- CATEGORIES CRUD -----------
app.get("/categories", async (req, res) => {
  try {
    const query = await connection.query("SELECT * FROM categories");
    res.send(query.rows);
  } catch {
    res.sendStatus(500);
  }
});

app.post("/categories", async (req, res) => {
  try {
    const { name } = req.body;

    if (inputIsEmpty(name)) {
      res.sendStatus(400);
    } else if (await nameIsNotAvailable(name, "categories")) {
      res.sendStatus(409);
    } else {
      const query = await connection.query(
        `INSERT INTO categories (name) VALUES ($1);`,
        [name]
      );
      res.sendStatus(201);
    }
  } catch (error) {
    res.sendStatus(500);
  }
});
// //

// ------------------- GAMES CRUD --------------------
app.get("/games", async (req, res) => {
  try {
    const name = req.query.name;
    if (name) {
      const query = await connection.query(
        `
    	SELECT 
    		games.*,
        	categories.name AS "categoryName" 
      	FROM games
        	JOIN categories
          	ON games."categoryId" = categories.id
		WHERE games.name ~*$1
    	`,
        [name]
      );
      res.send(query.rows);
    } else {
      const query = await connection.query(`
      	SELECT 
        	games.*,
        	categories.name AS "categoryName" 
      	FROM games
        	JOIN categories
          	ON games."categoryId" = categories.id
    	`);
      res.send(query.rows);
    }
  } catch {
    res.sendStatus(500);
  }
});

app.post("/games", async (req, res) => {
  try {
    const game = req.body;
    if (await gameObjIsInvalid(game)) {
      res.sendStatus(400);
    } else if (await nameIsNotAvailable(game.name, "games")) {
      res.sendStatus(409);
    } else {
      const query = await connection.query(
        `INSERT INTO 
				    games (name, image, "stockTotal", "categoryId", "pricePerDay") 
			    VALUES 
				    ($1, $2, $3, $4, $5);`,
        [
          game.name,
          game.image,
          game.stockTotal,
          game.categoryId,
          game.pricePerDay,
        ]
      );
      res.sendStatus(201);
    }
  } catch (error) {
    res.sendStatus(500);
  }
});
// //

// ----------------------- CUSTOMERS CRUD ----------------
app.get("/customers", async (req, res) => {
  try {
    const cpf = req.query.cpf;
    if (cpf) {
      const query = await connection.query(
        `SELECT * FROM customers WHERE customers.cpf ~*$1`,
        [cpf]
      );
      res.send(query.rows);
    } else {
      const query = await connection.query(`SELECT * FROM customers`);
      res.send(query.rows);
    }
  } catch {
    res.sendStatus(500);
  }
});

app.get("/customers/:id", async (req, res) => {
  try {
    const customerId = req.params.id;
    const query = await connection.query(
      `SELECT * FROM customers WHERE id = $1`,
      [customerId]
    );
    if (query.rowCount === 0) res.sendStatus(404);
    else res.status(200).send(query.rows);
  } catch (error) {
    res.sendStatus(500);
  }
});

app.post("/customers", async (req, res) => {
  try {
    const customer = req.body;
    if (await customerObjIsInvalid(customer)) {
      res.sendStatus(400);
    } else if (await cpfIsNotAvailable(customer.cpf)) {
      res.sendStatus(409);
    } else {
      const query = await connection.query(
        `INSERT INTO 
				    customers (name, phone, cpf, birthday) 
			    VALUES 
				    ($1, $2, $3, $4);`,
        [customer.name, customer.phone, customer.cpf, customer.birthday]
      );
      res.sendStatus(201);
    }
  } catch (error) {
    res.sendStatus(500);
  }
});

app.put("/customers/:id", async (req, res) => {
  try {
    const customerId = req.params.id;
    const customerUpdate = req.body;
    const newCpfIsNotAvailable = await cpfIsNotAvailable(customerUpdate.cpf);

    const customer = await connection.query(
      "SELECT * FROM customers WHERE customers.id = $1",
      [customerId]
    );
    if (customer.rowCount === 0) res.sendStatus(404);
    else {
      if (await customerObjIsInvalid(customerUpdate)) {
        res.sendStatus(400);
      } else if (
        newCpfIsNotAvailable &&
        newCpfIsNotAvailable.id !== parseInt(customerId)
      ) {
        res.sendStatus(409);
      } else {
        const query = await connection.query(
          `UPDATE customers SET 
            name = $1,
            phone = $2,
            cpf = $3,
            birthday = $4
          WHERE id = $5`,
          [
            customerUpdate.name,
            customerUpdate.phone,
            customerUpdate.cpf,
            customerUpdate.birthday,
            customerId,
          ]
        );
        res.sendStatus(200);
      }
    }
  } catch (error) {
    res.sendStatus(500);
  }
});
// //

// -----------------------  RENTALS CRUD ----------------
app.get("/rentals", async (req, res) => {
  try {
    const customerId = req.query.customerId;
    const gameId = req.query.gameId;
    const game = await connection.query(
      `SELECT * FROM games WHERE games.id = $1`,
      [gameId]
    );
    const customer = await connection.query(
      `SELECT * FROM customers WHERE customers.id = $1`,
      [customerId]
    );
    if (customerId && customer.rowCount === 0) res.sendStatus(404);
    else if (gameId && game.rowCount === 0) res.sendStatus(404);
    else {
      const query = await connection.query(`
        SELECT 
          rentals.*, 
          customers.name AS "customerName",
          games.name AS "gameName",
          games."categoryId",
          categories.name AS "categoryName" 
        FROM rentals
        JOIN customers
          ON rentals."customerId" = customers.id
        JOIN games
          ON rentals."gameId" = games.id
        JOIN categories
          ON games."categoryId" = categories.id
        ${customerId ? `WHERE rentals."customerId" = '${customerId}'` : ""}
        ${gameId ? `WHERE rentals."gameId" = '${gameId}'` : ""}
    `);
      const rentals = query.rows.map((rental) => {
        return {
          id: rental.id,
          customerId: rental.customerId,
          gameId: rental.gameId,
          rentDate: dayjs(rental.rentDate).format("YYYY-MM-DD"),
          daysRented: rental.daysRented,
          returnDate: rental.returnDate
            ? dayjs(rental.returnDate).format("YYYY-MM-DD")
            : null,
          originalPrice: rental.originalPrice,
          delayFee: rental.delayFee,
          customer: {
            id: rental.customerId,
            name: rental.customerName,
          },
          game: {
            id: rental.gameId,
            name: rental.gameName,
            categoryId: rental.categoryId,
            categoryName: rental.categoryName,
          },
        };
      });
      res.status(200).send(rentals);
    }
  } catch {
    res.sendStatus(500);
  }
});

app.post("/rentals", async (req, res) => {
  try {
    const { customerId, gameId, daysRented } = req.body;
    const today = dayjs().format("YYYY-MM-DD");
    console.log(await customerIdExist(customerId));
    if (
      (await !customerIdExist(customerId)) ||
      (await !gameIdExist(gameId)) ||
      (await !gameIsAvailable(gameId)) ||
      parseInt(daysRented) <= 0
    )
      res.sendStatus(400);
    else {
      const gameQuery = await connection.query(
        `SELECT * FROM games WHERE games.id = $1`,
        [customerId]
      );
      const game = gameQuery.rows[0];
      const originalPrice = parseInt(daysRented) * game.pricePerDay;
      const query = await connection.query(
        `
            INSERT INTO 
                rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee")
            VALUES
                ($1, $2, $3, $4, $5, $6, $7)
            `,
        [customerId, gameId, today, daysRented, null, originalPrice, null]
      );
      res.sendStatus(201);
    }
  } catch {
    res.sendStatus(500);
  }
});

app.post("/rentals/:id/return", async (req, res) => {
  try {
    const rentalId = req.params.id;
    const rentalQuery = await connection.query(
      `SELECT * FROM rentals WHERE rentals.id = $1`,
      [rentalId]
    );
    if (await rentalIdIsInvalid(rentalId)) res.sendStatus(404);
    else if (await rentalIsFinished(rentalId)) res.sendStatus(400);
    else {
      const rental = rentalQuery.rows[0];
      const today = dayjs();
      const rentDate = dayjs(rental.rentDate);
      const delayDays = today.diff(rentDate, "day") - rental.daysRented;
      const pricePerDay = rental.originalPrice / rental.daysRented;
      const delayFee = Number(delayDays * pricePerDay);
      const updateQuery = await connection.query(
        `
                UPDATE rentals SET 
                    "returnDate" = $1, 
                    "delayFee" = $2
                WHERE id = $3
                `,
        [today.format("YYYY-MM-DD"), delayFee > 0 ? delayFee : null, rentalId]
      );
      res.sendStatus(200);
    }
  } catch (error) {
    res.sendStatus(500);
  }
});

app.delete("/rentals/:id", async (req, res) => {
  const rentalId = req.params.id;
  if (await rentalIdIsInvalid(rentalId)) res.sendStatus(404);
  else if (await rentalIsFinished(rentalId)) res.sendStatus(400);
  else {
    const query = await connection.query(`DELETE FROM rentals WHERE id = $1;`, [
      rentalId,
    ]);
    res.sendStatus(200);
  }
});
// //

app.listen(4000); // start server
