"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
// Register api
// Add your own code here to customize or restrict how the public can register new users.
axios_1.default
    .post("http://localhost:1337/api/auth/local/register", {
    username: "",
    email: "",
    password: "",
})
    .then((response) => {
    // Handle success.
    console.log("Well done!");
    console.log("User profile", response.data.user);
    console.log("User token", response.data.jwt);
})
    .catch((error) => {
    // Handle error.
    console.log("An error occurred:", error.response);
});
//   Login api
axios_1.default
    .post("http://localhost:1337/api/auth/local", {
    identifier: "",
    password: "",
})
    .then((response) => {
    // Handle success.
    console.log("User is logged in");
    console.log("User profile", response.data.user);
    console.log("User token", response.data.jwt);
})
    .catch((error) => {
    // Handle error.
    console.log("An error occurred:", error.response);
});
// Forgot Password
axios_1.default
    .post("http://localhost:1337/api/auth/forgot-password", {
    email: "",
    url: "http:/localhost:1337/admin/plugins/users-permissions/auth/reset-password",
})
    .then((response) => {
    // Handle success.
    console.log("User profile", response.data.user);
    console.log("Your user received an email");
})
    .catch((error) => {
    // Handle error.
    console.log("An error occurred:", error.response);
});
// Reset Password
axios_1.default
    .post("http://localhost:1337/api/auth/reset-password", {
    code: "",
    password: "",
    passwordConfirmation: "",
})
    .then((response) => {
    // Handle success.
    console.log(response.data.user);
    console.log("Your user's password has been changed.");
})
    .catch((error) => {
    // Handle error.
    console.log("An error occurred:", error.response);
});
