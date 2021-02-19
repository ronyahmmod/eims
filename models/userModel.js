const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');
const moment = require('moment');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User must have a name'],
      maxlength: [40, 'User name is less than 40 charachters'],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: [true, 'User must have an email address'],
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: 'Please provide a valid email address 😪',
      },
    },
    mobileNo: {
      type: String,
      required: [true, 'User must have a mobile number.'],
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'operator', 'principal', 'accountant'],
      default: 'user',
    },
    password: {
      type: String,
      required: [true, 'User must have a password'],
      minlength: [6, 'User password >= 6 charachters'],
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Confirm password required'],
      minlength: [6, 'User password >= 6 charachters'],
      validate: {
        validator: function (val) {
          return this.password === val;
        },
        message: 'Please be sure that password and confirm password is same?',
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});
// userSchema.pre(/^find/, function (next) {

// });
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  // console.log(this.passwordChangedAt);
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changePasswordAfter = function (tokenIssuedTime) {
  let changedTimeStamp = 0;
  if (this.passwordChangedAt) {
    changedTimeStamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
  }
  // console.log(changedTimeStamp);
  return tokenIssuedTime < changedTimeStamp;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // console.log(moment(now).add(10, 'minutes').format());
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  // console.log(this.passwordResetExpires);
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
