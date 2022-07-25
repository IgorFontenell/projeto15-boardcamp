import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import joi from "joi";
import dayjs from 'dayjs';

dotenv.config();

const server = express(); // Cria o servidor.
server.use(express.json()); // Torna legível os dados recebidos.
server.use(cors()); // Permite o acesso de outras portas ao código rodando.

const { Pool } = pkg;

const connection = new Pool({
    connectionString: 'postgres://bootcamp_role:senha_super_hiper_ultra_secreta_do_role_do_bootcamp@localhost:5432/boardcamp',
});

// Configura que função será executada quando um GET bater na rota "/".
server.get("/categories", async (request, response) => {
  const { rows: categories} = await connection.query('SELECT * FROM categories');

  response.send(categories);

});

server.post("/categories", async (request, response) => {
    try {
        const categorie = request.body;
        const categorieSchema = joi.object({
            name: joi.required()
        });

        const validation = categorieSchema.validate(categorie);
        
        if(validation.error) {
            return response.status(400).send("Categoria não pode ser vazia!");
        }
        const igualCategory = await connection.query(`SELECT * FROM categories WHERE name = ($1)`, [categorie.name]);
        
        if (igualCategory.rows.length === 1 ) {
            return response.status(409).send("Categoria já existente!");
        }
        await connection.query(`INSERT INTO categories (name) VALUES ($1)`, [categorie.name]);
        
        response.sendStatus(201);
    } catch {
        response.status(400).send("Algo deu errado com o servidor");
    }
  
});

server.get("/games", async (request, response) => {
    const { rows: games } = await connection.query(`
    SELECT games.*, categories.name FROM games
    JOIN categories 
    ON games."categoryId" = categories.id`);

    response.send(games);
  
});

server.post("/games", async (request, response) => {
    const {
        name,
        image,
        stockTotal,
        categoryId,
        pricePerDay
        } = request.body;

    const gameSchema = joi.object({
        name: joi.string().required(),
        image: joi.string().uri().required(),
        stockTotal: joi.number().integer().min(1).required(),
        categoryId: joi.number().integer().min(1).required(),
        pricePerDay: joi.number().integer().min(1).required()
    });
    
    const validation = gameSchema.validate(request.body);

    if(validation.error) {
        return response.status(400).send("Jogo inserido incorretamente!");
    };
    const existingCategory = await connection.query(`SELECT * FROM categories WHERE id = $1`, [categoryId]);

    if(existingCategory.rows.length === 0){
        return response.status(400).send("Não existe essa categoria!");
    };

    const existingGame = await connection.query(`SELECT * FROM games WHERE name = $1`, [name]);

    if(existingGame.rows.length !== 0){
        return response.status(409).send("Nome já existente!");
    };

    await connection.query(`INSERT INTO games ("name", "image", "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)`, [name, image, stockTotal,categoryId, pricePerDay]);

    response.status(201).send("Jogo Criado com Sucesso!");
})

server.get("/customers", async (request, response) => {
    const {rows: customers} = await connection.query('SELECT * FROM customers');
    response.send(customers);
});

server.get("/customers/:id", async (request, response) => {
    const id = request.params.id;
    const { rows: customers } = await connection.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (customers === []) {
        return response.status(404).send("Id não encontrado!");
    }
    response.send(customers);
});

server.post("/customers/", async (request, response) => {
    try {
        const {
            name,
            phone,
            cpf,
            birthday
        } = request.body;
        
        const customersSchema = joi.object({
         name: joi.string().required(),
         phone: joi.string().pattern(/[0-9]{10,11}/).required(),
         cpf: joi.string().pattern(/[0-9]{11}/).required(),
         birthday: joi.date().max('now').required()
        });
     
        const validation = customersSchema.validate(request.body);
     
        if(validation.error) {
            return response.status(400).send("Cliente não cadastrado corretamente!");
        }
     
        const existingCPF = await connection.query(`SELECT * FROM customers WHERE cpf = $1`, [cpf]);
     
        if (existingCPF.rows.length !== 0) {
             return response.status(409).send("CPF já cadastrado!");
        }
     
        await connection.query(`INSERT INTO customers ("name","phone","cpf","birthday") VALUES ($1, $2, $3, $4)`, [name, phone, cpf, birthday]);

        response.sendStatus(201);

    } catch {
        response.sendStatus(500);
    }
   


});

server.put("/customers/:id", async (request, response) => {
    try {
        const id = request.params.id;
        const {
            name,
            phone,
            cpf,
            birthday
        } = request.body;
        
        const customersSchema = joi.object({
        name: joi.string().required(),
        phone: joi.string().pattern(/[0-9]{10,11}/).required(),
        cpf: joi.string().pattern(/[0-9]{11}/).required(),
        birthday: joi.date().max('now').required()
        });
    
        const validation = customersSchema.validate(request.body);
    
        if(validation.error) {
            return response.status(400).send("Cliente não cadastrado corretamente!");
        }

        const existingCPF = await connection.query(`SELECT * FROM customers WHERE cpf = $1`, [cpf]);
        
        if (existingCPF.rows[0] && existingCPF.rows[0].id !== id) {
            return response.status(409).send("CPF já cadastrado!");
        }
        const newBirthDay = dayjs(birthday).format("YYYY/MM/DD");

        await connection.query(`UPDATE customers SET name=$1, phone=$2, cpf=$3, birthday=$4 WHERE id = $5`, [name, phone, cpf, newBirthDay, id]);
        
        response.sendStatus(200);
    } catch {
        response.sendStatus(500);
    }
    
 });

 server.get("/rentals", async (request, response) => {
    try {
        const { customerId } = request.query;
        let rental;

        if (customerId) {
            rental = await connection.query(`SELECT * FROM rentals WHERE 'customerId' LIKE $1 || '%'`, [customerId]);
            } else {
            rental = await connection.query(`SELECT * FROM rentals`);
            }
        response.status(200).send(rental.rows);

    } catch {
        response.sendStatus(500);
    }
    
       
 });

 server.post("/rentals", async (request, response) => {
     try {
        const now = dayjs().format('YYYY-MM-DD');
    
        const rent = request.body;

        const rentalSchema = joi.object({
            customerId: joi.number().required(),
            gameId: joi.number().required(),
            daysRented: joi.number().min(1).required()
        });

        const validation = rentalSchema.validate(rent);

        if(validation.error) {
            return response.status(400).send("Dados inseridos incorretamente!");
        }

        const { rows: customer } = await connection.query(`SELECT * FROM customers WHERE id = $1`, [rent.customerId]);
        const { rows: game } = await connection.query(`SELECT * FROM games WHERE id = ($1)`, [rent.gameId]);
        const { rows: gameRents } = await connection.query(`SELECT * FROM rentals WHERE 'gameId' = ($1)`, [rent.gameId]);
    
        if(customer[0] === [] || game[0] === []) {
            return response.status(400).send("Cliente ou jogo não encontrado!");
        };
        let totalGamesRented = gameRents.find(object => object.returnDate === null);
        
        if(totalGamesRented && totalGamesRented.length === game[0].stockTotal) {
            return response.status(400).send("Não há mais jogos disponíveis!");
        }
        
        const rentInfo = {
            customerId: rent.customerId,
            gameId: rent.gameId,
            rentDate: now,
            daysRented: rent.daysRented,
            returnDate: null,
            originalPrice: rent.daysRented*game[0].pricePerDay,
            delayFee: null,
        }
        await connection.query(`INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee") VALUES ($1, $2, $3, $4, $5, $6, $7)`, [rentInfo.customerId, rentInfo.gameId, rentInfo.rentDate, rentInfo.daysRented, rentInfo.returnDate, rentInfo.originalPrice, rentInfo.delayFee]); 
        
        response.sendStatus(201);
     } catch {
        return response.sendStatus(500);
    }
    
 });

 server.post("/rentals/:id/return", async (request, response) => {
    try {
        const id = request.params.id;
        const today = dayjs();

        const { rows: rental } = await connection.query(`SELECT * FROM rentals WHERE id = $1`, [id]);

        if (rental[0] === []) {
            return response.sendStatus(404);
        }
        if (rental[0].returnDate !== null ){
            return response.sendStatus(404);
        }
        const { rows: game } = await connection.query(`SELECT * FROM games WHERE id = $1`, [rental[0].gameId]);
        const delayFee = today.diff(rental[0].rentDate, 'day')*game[0].pricePerDay;

        await connection.query(`UPDATE rentals SET "returnDate" = $1, "delayFee" = $2 WHERE id = $3`, [today, delayFee, rental[0].id ]);
    
        response.sendStatus(201); 
    } catch {
        return response.sendStatus(500);
    }
    
 });

 server.delete("/rentals/:id", async (request, response) => {
     try {
        const id = request.params.id;
    
        const { rows: rental } = await connection.query(`SELECT * FROM rentals WHERE id = $1`, [id]);

        if (rental[0] === []) {
            return response.sendStatus(404);
        }
        if (rental[0].returnDate === null ){
            return response.sendStatus(400);
        }
        

        await connection.query(`DELETE FROM rentals WHERE id = $1`, [id]);
        
        response.sendStatus(201);
     } catch {
         return response.sendStatus(500);
     }
    
});



server.listen(4000, () => console.log("Servidor rodando!")); // Configura o servidor para rodar na porta 4000 da minha máquina.'