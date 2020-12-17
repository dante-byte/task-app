const express = require("express");
const app = express();
const helmet = require("helmet");
const mongoose = require("./middleware/db");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const {List, Task, User} = require("./middleware/models");
app.use(bodyParser.json()); // used to allow passing req body of http req ex req.body.title
app.use(helmet.frameguard("deny"));
app.use(helmet.frameguard("sameorigin"));
app.use(helmet.noSniff());

app.set("port", process.env.PORT || 4000);


app.get('/', (req, res) => {
    res.send("API UP Running... ");
})






app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE"); // by default patch is not allowed

    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id"); // cors
    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    );

    next();
});

let authenticate = (req, res, next) => {
    /**
     * used to restrict access to protected routes
     * allow access to callers who have the correct access token
     *
     */

    let token = req.header('x-access-token'); // get token

    // getUWTSecret form user.js model
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {

        if (err) {

            // jwt is invalid - * do not authenticate
            res.status(401).send(err);
        } else {

            //jwt is valid
            req.user_id = decoded._id;//user id was encode with the secret
            next();
        }
    })
}

// verify refresh token middle ware which will be verifying the session
let verifySession = (req, res, next) => {

    // grab the refresh token from the reqest header
    let refreshToken = req.header('x-refresh-token');

    // grap the _id from the request header
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            // user couldn't be found
            return Promise.reject({
                "error": "user not found make sure that the refresh token and user id are correct"
            });
        }

        // if the code reaches here the user was found
        // there fore the refresh token exist in the database but we still have to check if it has expired or not

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session) => {

            if (session.token === refreshToken) {

                // check if the session has expired

                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    // refresh token has not expired
                    isSessionValid = true;
                }
            }
        });

        if (isSessionValid) {

            // the session is valid - call next() to continue with processing this web request
            next();
        } else {

            // the session is not valid
            return Promise.reject({
                "error": "Refresh token has expired or the session is invalid"
            })
        }
    }).catch((e) => {

        res.status(401).send(e);
    })
}




/** test **/
// app.get("/", (req, res) => {
//
//     res.send("test");
// })


/** GET: get all lists **/
app.get("/lists", authenticate,(req, res) => { // you should able to access your own list but only if you have the right cridentials
    // we want to return an array of all
    // the lists in the database that belong to the authenticated user
    List.find({
        _userId: req.user_id // only returned the list of the authenticated user
    }).then((lists) => {

        res.send(lists);
    }).catch((e) => {
        res.send(e);
    });

});

/** POST: creates a new list **/
app.post("/lists", authenticate, (req, res) => {
    // creates a new list and returns the
    // new lists document vack to teh user includes the id
    // the list information fields will be passed in via
    // the json request body

    let title = req.body.title;

    let newList = new List({
        title,
        _userId: req.user_id
    });
    newList.save().then((listDoc) => {

        res.send(listDoc);

    })
});

/** PATCH: update specific list list document with id in the url with the new values specified in json ***/
app.patch("/lists/:id", authenticate, (req, res) => {
    // update the specified list list document
    // with id in the url with the new values
    // specified in the json body of the request
    List.findOneAndUpdate({ _id: req.params.id,  _userId: req.user_id}, { // only the authenticated can update ther on list
        $set: req.body // update the list that finds

    }).then(() => {

        res.send({'message': 'updated successfully'});;
    });
});

/** DELETE: **/
app.delete('/lists/:id', authenticate, (req, res) => {
    // we want to delete the specified list (document with id in the url )
    List.findOneAndRemove({
        _id: req.params.id,
        _userId: req.user_id
    }).then((removedListDoc) => {
        res.send(removedListDoc)
        // delete all the tasks that are in the deleted list
        deleteTasksFromList(removedListDoc._id)
    });
});


/**
 *Get
 *
 * get all of the task
 * **/
app.get("/lists/:listId/tasks", authenticate, (req, res) => {

    Task.find({

        _listId: req.params.listId

    }).then((tasks) => {

        res.send(tasks)
    })


});

/**
 * GET
 * GET ONE TASK
 * **/
app.get("/lists/:listId/tasks/:taskId", (req, res) => {

    Task.findOne({

        title: req.body.title,
        _listId: req.params.listId

    }).then((task) => {

        res.send(task)
    })
})

app.post("/lists/:listId/tasks", authenticate, (req, res) => {
    // we want to create a new task in a list specified by listId
    List.findOne({

        _id: req.params.listId,
        _userId: req.user_id

    }).then((list) => {

        if (list) {
            // lisr object is valid  list object with the specified sonditions was found
            // there for the currently authenticated user can create new tasks
            return true
        }

        // else the user object is undefined
        return false
    }).then((canCreateTask) => {

        if (canCreateTask) {

            let newTask = new Task({

                title: req.body.title,
                _listId: req.params.listId
            });

            newTask.save().then((newTaskDoc) => {
                res.send(newTaskDoc);

            })


        } else {

            res.sendStatus(404); // this list id that they are trying to access is not found, for the client request
        }


    })

    // create a new task in a list specified by listId



});


/**
 * patch
 * /lists/:listsid/tasks/:taskid
 * update an existing task
 * **/
app.patch("/lists/:listId/tasks/:taskId", authenticate,  (req, res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {

        if (list) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can make update to tasks witin this list

            return true


        }

        return false
    }).then((canUpdateTasks) => {

        if (canUpdateTasks) {

            // the currently authenticated user can update tasks

            Task.findOneAndUpdate({

                _id: req.params.taskId,
                _listId: req.params.listId // updates a specific title of a a document
            }, {

                $set: req.body // update statement
            }).then(() => {

                // res.sendStatus(200); //senb back if successful this caused a json error because we didnt send back json

                res.send({message: "updated successfully"})
            })

        } else {

            res.sendStatus(404);
        }
    })

    // we want to update an existing task specified by taskid


});

/**
 * Delte
 * **/

app.delete("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {


    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {

        if (list) {
            // list object with the specified conditions was found
            // therefore the currently authenticated user can make update to tasks witin this list

            return true


        }

        return false
    }).then((canDeleteTasks) => {

        if (canDeleteTasks) {

            Task.findOneAndRemove({
                _id: req.params.taskId,
                _listId: req.params.listId

            }).then((removedTaskDoc) => {

                res.send(removedTaskDoc);


            })


        } else {

            res.sendStatus(404);
        }




    })












})

/** user routes */

/**
 * POST
 * USER
 * PURPOSE: sign up
 */


app.post("/users", (req, res) => {

    //user sign up

    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(() => {

        return newUser.createSession();

    }).then((refreshToken) => {

        // session created successfully - refreshtoken returned.
        // now i can generate an access auth token for the user

        return newUser.generateAccessAuthToken().then((accessToken) => {

            return{accessToken, refreshToken} // so that client an received
        })
    }).then((authTokens) => {
        // now we construct and send the response to the user with their auth token in the header
        // and the user object in the body
        res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(newUser);


    }).catch((e) => {
        res.status(400).send(e);
    })

})

/** Post
 * /users/login
 * purpose: login
 */

app.post("/users/login", (req, res) => {

    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user) => {

        // user is return to us
        return user.createSession().then((refreshToken) => {
            //session created succcessfully - refreshtoken returned.
            //now we generate an access auth token for the user

            return user.generateAccessAuthToken().then((accessToken) => {

                // access auth token generated successfully now we return an object containing the auth tokens
                return { accessToken, refreshToken}

            });
        }).then((authTokens) => { // get auth token

            // now construct and send the response to the user with their auth tokens in the header and the user object in the body

            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(user)
        })
    }).catch((e) => { // catch any errors
        res.status(400).send(e);
    })
})



/**
 * get /users/me/access-token
 * purpose: generates and returns an accesstoken
 */

app.get("/users/me/access-token", verifySession, (req, res) => {

    // we know that the user/caller is authenticated and we have the user _id and user object avaliavle to us
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({accessToken});

    }).catch((e) => {
        res.status(400).send(e);
    });
});

/**
 * helper method
 */

let deleteTasksFromList = (_listId) => {
    Task.deleteMany({
        _listId
    }).then(() => {
        console.log("tasks from " + _listId + "were delted")
    })
}

// helper methods

// let deleteTasksFromList = (_listId) => {
//
//     Task.deleteMany({
//         _listId
//     });
// }




//console.log(db_host);
app.listen(app.get("port"), () => {

    console.log(`server started on port http://localhost:${app.get("port")}`);
})