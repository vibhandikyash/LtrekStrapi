"use strict";
const { yup, validateYupSchema } = require("@strapi/utils");
const callbackSchema = yup.object({
    email: yup.string().email().required(),
    password: yup.string().required(),
});
const registerSchema = yup.object({
    email: yup.string().email().required(),
    name: yup.string().required(),
    password: yup.string().required(),
    countryCode: yup
        .string()
        .matches(/^\+(\d{1}\-)?(\d{1,4})$/, "Invalid Country Code"),
    mobile: yup
        .number()
        .integer("Invalid mobile number")
        .test("empty or 10 character check", "Invalid mobile number", (val) => !val || val.toString().length === 10),
});
const sendEmailConfirmationSchema = yup.object({
    email: yup.string().email().required(),
});
const validateEmailConfirmationSchema = yup.object({
    confirmation: yup.string().required(),
});
const forgotPasswordSchema = yup
    .object({
    email: yup.string().email().required(),
})
    .noUnknown();
const resetPasswordSchema = yup
    .object({
    password: yup.string().required(),
    // passwordConfirmation: yup.string().required(),
    code: yup.string().required(),
})
    .noUnknown();
const changePasswordSchema = yup
    .object({
    password: yup.string().required(),
    passwordConfirmation: yup
        .string()
        .required()
        .oneOf([yup.ref("password")], "Passwords do not match"),
    currentPassword: yup.string().required(),
})
    .noUnknown();
module.exports = {
    validateCallbackBody: validateYupSchema(callbackSchema),
    validateRegisterBody: validateYupSchema(registerSchema),
    validateSendEmailConfirmationBody: validateYupSchema(sendEmailConfirmationSchema),
    validateEmailConfirmationBody: validateYupSchema(validateEmailConfirmationSchema),
    validateForgotPasswordBody: validateYupSchema(forgotPasswordSchema),
    validateResetPasswordBody: validateYupSchema(resetPasswordSchema),
    validateChangePasswordBody: validateYupSchema(changePasswordSchema),
};
