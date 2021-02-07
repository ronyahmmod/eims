const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

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

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

  next();
});

module.exports = mongoose.model('User', userSchema);
