"use strict";
const mongoose = require("mongoose");
//middleware.Promise = global.Promise;


    mongoose.Promise = global.Promise;
    mongoose.connect("mongodb://localhost:27017/taskapi_db", {

        useNewUrlParser: true,
        useUnifiedTopology: true  }).then(() => {
    console.log("connected to db successfully");
    }).catch((e) => {
    console.log("error attempting to connect to db");
    console.log(e);
    });

    mongoose.set("useCreateIndex", true);
    mongoose.set("useFindAndModify", false);


    module.exports = {
            mongoose
    }


        // db.connection.once("open", () => {
        //
        //     console.log("mongodb connected successfully....")
        // });










