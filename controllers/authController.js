const { promisify } = require('util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  res.cookie('jwt', token, {
    expiresIn: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const userBody = {
    name: req.body.name,
    email: req.body.email,
    mobileNo: req.body.mobileNo,
    role: req.body.role,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  };

  const newUser = await User.create(userBody);
  createSendToken(newUser, 200, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  // 1) Get email and password
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError('Please provide your email and password', 403));
  // 2) check email and password are correct
  const user = await User.findOne({ email: email }).select('+password');
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Invalid email and password', 401));
  }
  // 3) if correct then generate new token and send it
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expiresIn: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

// protect route
exports.protect = catchAsync(async (req, res, next) => {
  // 1) get jwt token from request or cookies
  let token;
  if (
    req.header.authorization &&
    req.headers.authorization.startsWith('bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please loged in to get access', 401)
    );
  }

  // 2) Verify the token and get the correct user
  const decode = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check user exist yet
  const currentUuser = await User.findById(decode.id);
  if (!currentUuser) {
    return next(
      new AppError('The user belonging this token no longer exist.', 401)
    );
  }

  // 4) check user has changed the password after token is issued
  // console.log(decode.iat);

  if (currentUuser.changePasswordAfter(decode.iat)) {
    return next(
      new AppError('User recently changed password! Please login again.')
    );
  }

  // 5) if all the condition is true then get permission
  req.user = currentUuser;
  res.locals.user = currentUuser;
  next();
});

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      const decode = await promisify(jwt.decode)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      const currentUuser = await User.findById(decode.id);
      if (!currentUuser) return next();
      if (currentUuser.changePasswordAfter(decode.iat)) return next();
      res.locals.user = currentUuser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You dont have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) get email address from the request body
  const email = req.body.email;
  // 2) check user already exists
  const user = await User.findOne({ email: email });
  if (!user)
    return next(
      new AppError(
        'There is no user exist at this account! Please try with another.',
        404
      )
    );
  // 3) if true create password reset token
  const passwordResetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  // 4) send password reset token to the user email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${passwordResetToken}`;
    await new Email(user, resetURL).sendPasswordReset();
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There is an error sending this email. Try again latter.',
        404
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 404));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;
  await user.save();

  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('password');
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Wrong password!', 401));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  createSendToken(user, 200, req, res);
});
