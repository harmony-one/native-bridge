const nodemailer = require('nodemailer')
const config = require('../config')

const emailer = {

  sendMail: function(subject, text, callback) {
    const mailOptions = {
      from: '"Harmony BNBridge" <bnbridge@harmony.one>',
      to: 'li@harmony.one',
      cc: ['sahil@harmony.one', 'dennis@harmony.one'],
      subject: subject,
      text: text
    }

    emailer._sendMail(mailOptions, callback)
  },

  _sendMail: function(mailOptions, callback) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.emailerUser,
        pass: config.emailerPassword
      }
    });

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error)
      }

      if (callback != null) {
        callback(error, info)
      }
    })
  }
}

module.exports = emailer
