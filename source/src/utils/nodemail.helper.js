const dotenv = require('dotenv').config();
const nodemailer = require('nodemailer');
const engine = require('express-handlebars');
// create instance for handlebar 
const hbs = engine.create({
    extname: '.hbs'
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.OUR_EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});


const sendVerify = async ({ to, username, token }) => {
    try {
        let mailOptions = {
            from: process.env.OUR_EMAIL,
            to,
            subject: 'verification email',
            html: await hbs.render('./src/templates/verify_mail.hbs', {
                token,
                username,
                clientDomain: 'http://192.168.241.16:3000/v1'
            }),
        };
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log(err);
            else console.log('Email send:', info.response);
        });
    } catch (err) {
        throw err;
    }
};

const sendWelcomeToNewAccount = async ({ to, username, name, password, isAdmin }) => {
    try {
        let mailOptions = {
            from: process.env.OUR_EMAIL,
            to,
            subject: 'Welcome to Chat app',
            html: await hbs.render('./src/templates/welcome_mail.hbs', {
                username,
                password,
                name,
                role: isAdmin ? 'admin' : 'user',
                clientDomain: 'http://localhost:3000/v1'
            }),
            attachments: [
                {
                    filename: 'hinh1.jpg',
                    path: './resources/images/hinh4.jpg',
                    cid: 'logo_image'
                }
            ]
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log(err);
            else console.log('Email send: ', info.reponse);
        });

    } catch (error) {
        throw err;
    }
};
module.exports = {
    sendVerify,
    sendWelcomeToNewAccount
};

