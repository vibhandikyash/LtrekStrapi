"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@strapi/utils");
const deleteRoleSchema = utils_1.yup.object().shape({
    role: utils_1.yup.strapiID().required(),
});
const createUserBodySchema = utils_1.yup.object().shape({
    email: utils_1.yup.string().email().required(),
    name: utils_1.yup.string().min(1).required(),
    password: utils_1.yup.string().min(1).required(),
    role: utils_1.yup.lazy((value) => typeof value === "object"
        ? utils_1.yup
            .object()
            .shape({
            connect: utils_1.yup
                .array()
                .of(utils_1.yup.object().shape({ id: utils_1.yup.strapiID().required() }))
                .min(1, "Users must have a role")
                .required(),
        })
            .required()
        : utils_1.yup.strapiID().required()),
});
const updateUserBodySchema = utils_1.yup.object().shape({
    email: utils_1.yup.string().email().min(1),
    name: utils_1.yup.string().min(1),
    password: utils_1.yup.string().min(1),
    role: utils_1.yup.lazy((value) => typeof value === "object"
        ? utils_1.yup.object().shape({
            connect: utils_1.yup
                .array()
                .of(utils_1.yup.object().shape({ id: utils_1.yup.strapiID().required() }))
                .required(),
            disconnect: utils_1.yup
                .array()
                .test("CheckDisconnect", "Cannot remove role", function test(disconnectValue) {
                if (value.connect.length === 0 && disconnectValue.length > 0) {
                    return false;
                }
                return true;
            })
                .required(),
        })
        : utils_1.yup.strapiID()),
});
module.exports = {
    validateCreateUserBody: (0, utils_1.validateYupSchema)(createUserBodySchema),
    validateUpdateUserBody: (0, utils_1.validateYupSchema)(updateUserBodySchema),
    validateDeleteRoleBody: (0, utils_1.validateYupSchema)(deleteRoleSchema),
};
