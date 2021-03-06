// send email user by send grid
// thanks for sendgrid.com
// const sendGridMail = require('@sendgrid/mail');
const sgMail = require('@sendgrid/mail');
const nodeMailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Md. Rony Ahmmod <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      return sgMail;
    }

    return nodeMailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    // send actual mail
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });
    // const html = '<h1>Hi</h1>';

    // define mail options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.fromString(html),
    };

    // create a transport and send email
    if (process.env.NODE_ENV === 'production') {
      await this.newTransport().send(mailOptions);
    } else {
      await this.newTransport().sendMail(mailOptions);
    }
  }

  async sendWelcome() {
    await this.send('welcome', 'Welecome to EIMS');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for 10 minuites).'
    );
  }
};
