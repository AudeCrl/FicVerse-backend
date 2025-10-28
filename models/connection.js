const mongoose = require("mongoose");

const connectionString = process.env.CONNECTION_STRING;
mongoose
  .connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Base de données connectée !"))
  .catch((err) => console.error("Erreur de connexion :", err));

module.exports = mongoose;
