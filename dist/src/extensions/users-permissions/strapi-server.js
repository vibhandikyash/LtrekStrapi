"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("@strapi/utils");
const { getService } = require("@strapi/plugin-users-permissions/server/utils");
const { validateCallbackBody, validateRegisterBody, validateSendEmailConfirmationBody, validateForgotPasswordBody, validateResetPasswordBody, validateEmailConfirmationBody, validateChangePasswordBody, } = require("./validation/auth");
const crypto = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const sanitizeUser = (user, ctx) => {
    const { auth } = ctx.state;
    const userSchema = strapi.getModel("plugin::users-permissions.user");
    return sanitize.contentAPI.output(user, userSchema, { auth });
};
const { getAbsoluteAdminUrl, getAbsoluteServerUrl, sanitize } = utils;
const { contentTypes: contentTypesUtils } = require("@strapi/utils");
const { ApplicationError, ValidationError, NotFoundError, ForbiddenError } = require("@strapi/utils").errors;
const { validateCreateUserBody, validateUpdateUserBody, } = require("./validation/user");
const { UPDATED_BY_ATTRIBUTE, CREATED_BY_ATTRIBUTE } = contentTypesUtils.constants;
const userModel = "plugin::users-permissions.user";
const ACTIONS = {
    read: "plugin::content-manager.explorer.read",
    create: "plugin::content-manager.explorer.create",
    edit: "plugin::content-manager.explorer.update",
    delete: "plugin::content-manager.explorer.delete",
};
const findEntityAndCheckPermissions = async (ability, action, model, id) => {
    const entity = await strapi.query(userModel).findOne({
        where: { id },
        populate: [`${CREATED_BY_ATTRIBUTE}.roles`],
    });
    if (lodash_1.default.isNil(entity)) {
        throw new NotFoundError();
    }
    const pm = strapi["admin"].services.permission.createPermissionsManager({
        ability,
        action,
        model,
    });
    if (pm.ability.cannot(pm.action, pm.toSubject(entity))) {
        throw new ForbiddenError();
    }
    const entityWithoutCreatorRoles = lodash_1.default.omit(entity, `${CREATED_BY_ATTRIBUTE}.roles`);
    return { pm, entity: entityWithoutCreatorRoles };
};
module.exports = (plugin) => {
    plugin.controllers.auth.callback = async (ctx) => {
        const provider = ctx.params.provider || "local";
        const params = ctx.request.body;
        const store = strapi.store({ type: "plugin", name: "users-permissions" });
        const grantSettings = await store.get({ key: "grant" });
        const grantProvider = provider === "local" ? "email" : provider;
        if (!lodash_1.default.get(grantSettings, [grantProvider, "enabled"])) {
            throw new ApplicationError("This provider is disabled");
        }
        if (provider === "local") {
            await validateCallbackBody(params);
            const { email } = params;
            // Check if the user exists.
            const user = await strapi
                .query("plugin::users-permissions.user")
                .findOne({
                where: {
                    provider,
                    email: email.toLowerCase(),
                },
            });
            if (!user) {
                throw new ValidationError("Invalid email or password");
            }
            if (!user.password) {
                throw new ValidationError("Invalid email or password");
            }
            const validPassword = await getService("user").validatePassword(params.password, user.password);
            if (!validPassword) {
                throw new ValidationError("Invalid email or password");
            }
            const advancedSettings = await store.get({ key: "advanced" });
            const requiresConfirmation = lodash_1.default.get(advancedSettings, "email_confirmation");
            if (requiresConfirmation && user.confirmed !== true) {
                throw new ApplicationError("Your account email is not confirmed");
            }
            if (user.blocked === true) {
                throw new ApplicationError("Your account has been blocked by an administrator");
            }
            return ctx.send({
                jwt: getService("jwt").issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        }
        // Connect the user with the third-party provider.
        try {
            const user = await getService("providers").connect(provider, ctx.query);
            return ctx.send({
                jwt: getService("jwt").issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        }
        catch (error) {
            throw new ApplicationError(error.message);
        }
    };
    plugin.controllers.auth.connect = async (ctx, next) => {
        const grant = require("grant-koa");
        const providers = await strapi
            .store({ type: "plugin", name: "users-permissions", key: "grant" })
            .get();
        const apiPrefix = strapi.config.get("api.rest.prefix");
        const grantConfig = {
            defaults: {
                prefix: `${apiPrefix}/connect`,
            },
            ...providers,
        };
        const [requestPath] = ctx.request.url.split("?");
        const provider = requestPath.split("/connect/")[1].split("/")[0];
        if (!lodash_1.default.get(grantConfig[provider], "enabled")) {
            throw new ApplicationError("This provider is disabled");
        }
        if (!strapi.config.server.url.startsWith("http")) {
            strapi.log.warn("You are using a third party provider for login. Make sure to set an absolute url in config/server.js. More info here: https://docs.strapi.io/developer-docs/latest/plugins/users-permissions.html#setting-up-the-server-url");
        }
        // Ability to pass OAuth callback dynamically
        grantConfig[provider].callback =
            lodash_1.default.get(ctx, "query.callback") ||
                lodash_1.default.get(ctx, "session.grant.dynamic.callback") ||
                grantConfig[provider].callback;
        grantConfig[provider].redirect_uri =
            getService("providers").buildRedirectUri(provider);
        return grant(grantConfig)(ctx, next);
    };
    plugin.controllers.auth.register = async (ctx) => {
        const pluginStore = await strapi.store({
            type: "plugin",
            name: "users-permissions",
        });
        const settings = await pluginStore.get({ key: "advanced" });
        if (!settings.allow_register) {
            throw new ApplicationError("Register action is currently disabled");
        }
        const params = {
            ...lodash_1.default.omit(ctx.request.body, [
                "confirmed",
                "blocked",
                "confirmationToken",
                "resetPasswordToken",
                "provider",
            ]),
            provider: "local",
        };
        await validateRegisterBody(params);
        const role = await strapi
            .query("plugin::users-permissions.role")
            .findOne({ where: { type: settings.default_role } });
        if (!role) {
            throw new ApplicationError("Impossible to find the default role");
        }
        const { email, name, provider } = ctx.request.body;
        const identifierFilter = {
            $or: [
                { email: email.toLowerCase() },
                { name: email.toLowerCase() },
                { name },
                { email: name },
            ],
        };
        const conflictingUserCount = await strapi
            .query("plugin::users-permissions.user")
            .count({
            where: { ...identifierFilter, provider },
        });
        if (conflictingUserCount > 0) {
            throw new ApplicationError("Email or name are already taken");
        }
        if (settings.unique_email) {
            const conflictingUserCount = await strapi
                .query("plugin::users-permissions.user")
                .count({
                where: { ...identifierFilter },
            });
            if (conflictingUserCount > 0) {
                throw new ApplicationError("Email or name are already taken");
            }
        }
        const newUser = {
            ...params,
            role: role.id,
            email: email.toLowerCase(),
            name,
            confirmed: !settings.email_confirmation,
        };
        const user = await getService("user").add(newUser);
        const sanitizedUser = await sanitizeUser(user, ctx);
        if (settings.email_confirmation) {
            try {
                await getService("user").sendConfirmationEmail(sanitizedUser);
            }
            catch (err) {
                throw new ApplicationError(err.message);
            }
            return ctx.send({ user: sanitizedUser });
        }
        const jwt = getService("jwt").issue(lodash_1.default.pick(user, ["id"]));
        return ctx.send({
            jwt,
            user: sanitizedUser,
        });
    };
    plugin.controllers.auth.resetPassword = async (ctx) => {
        const { password, code } = await validateResetPasswordBody(ctx.request.body);
        // if (password !== passwordConfirmation) {
        //   throw new ValidationError("Passwords do not match");
        // }
        const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { resetPasswordToken: code } });
        if (!user) {
            throw new ValidationError("Incorrect code provided");
        }
        await getService("user").edit(user.id, {
            resetPasswordToken: null,
            password,
        });
        // Update the user.
        ctx.send({
            jwt: getService("jwt").issue({ id: user.id }),
            user: await sanitizeUser(user, ctx),
        });
    };
    plugin.controllers.auth.changePassword = async (ctx) => {
        var _a;
        if (!ctx.state.user) {
            throw new ApplicationError("You must be authenticated to reset your password");
        }
        const { currentPassword, password } = await validateChangePasswordBody((_a = ctx.request) === null || _a === void 0 ? void 0 : _a.body);
        const user = await strapi.entityService.findOne("plugin::users-permissions.user", ctx.state.user.id);
        const validPassword = await getService("user").validatePassword(currentPassword, user.password);
        if (!validPassword) {
            throw new ValidationError("The provided current password is invalid");
        }
        if (currentPassword === password) {
            throw new ValidationError("Your new password must be different than your current password");
        }
        await getService("user").edit(user.id, { password });
        ctx.send({
            jwt: getService("jwt").issue({ id: user.id }),
            user: await sanitizeUser(user, ctx),
        });
    };
    plugin.controllers.auth.forgotPassword = async (ctx) => {
        var _a;
        const { email } = await validateForgotPasswordBody((_a = ctx.request) === null || _a === void 0 ? void 0 : _a.body);
        const pluginStore = await strapi.store({
            type: "plugin",
            name: "users-permissions",
        });
        const emailSettings = await pluginStore.get({ key: "email" });
        const advancedSettings = await pluginStore.get({ key: "advanced" });
        // Find the user by email.
        const user = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { email: email.toLowerCase() } });
        if (!user || user.blocked) {
            throw new ValidationError("Email not found!");
        }
        // Generate random token.
        const userInfo = await sanitizeUser(user, ctx);
        const resetPasswordToken = crypto.randomInt(111111, 999999).toString();
        const resetPasswordSettings = lodash_1.default.get(emailSettings, "reset_password.options", {});
        const emailBody = await getService("users-permissions").template(resetPasswordSettings.message, {
            URL: advancedSettings.email_reset_password,
            SERVER_URL: getAbsoluteServerUrl(strapi.config),
            ADMIN_URL: getAbsoluteAdminUrl(strapi.config),
            USER: userInfo,
            TOKEN: resetPasswordToken,
        });
        const emailObject = await getService("users-permissions").template(resetPasswordSettings.object, {
            USER: userInfo,
        });
        const emailToSend = {
            to: user.email,
            from: resetPasswordSettings.from.email || resetPasswordSettings.from.name
                ? `${resetPasswordSettings.from.name} <${resetPasswordSettings.from.email}>`
                : undefined,
            replyTo: resetPasswordSettings.response_email,
            subject: emailObject,
            text: emailBody,
            html: emailBody,
        };
        // NOTE: Update the user before sending the email so an Admin can generate the link if the email fails
        await getService("user").edit(user.id, { resetPasswordToken });
        // Send an email to the user.
        await strapi.plugin("email").service("email").send(emailToSend);
        ctx.send({ ok: true });
    };
    plugin.controllers.contentmanageruser.create = async (ctx) => {
        const { body } = ctx.request;
        const { user: admin, userAbility } = ctx.state;
        const { email, name } = body;
        const pm = strapi["admin"].services.permission.createPermissionsManager({
            ability: userAbility,
            action: ACTIONS.create,
            model: userModel,
        });
        if (!pm.isAllowed) {
            return ctx.forbidden();
        }
        const sanitizedBody = await pm.pickPermittedFieldsOf(body, {
            subject: userModel,
        });
        const advanced = await strapi
            .store({ type: "plugin", name: "users-permissions", key: "advanced" })
            .get();
        await validateCreateUserBody(ctx.request.body);
        const userWithSameUsername = await strapi
            .query("plugin::users-permissions.user")
            .findOne({ where: { name } });
        if (userWithSameUsername) {
            throw new ApplicationError("Name already taken");
        }
        if (advanced.unique_email) {
            const userWithSameEmail = await strapi
                .query("plugin::users-permissions.user")
                .findOne({ where: { email: email.toLowerCase() } });
            if (userWithSameEmail) {
                throw new ApplicationError("Email already taken");
            }
        }
        const user = {
            ...sanitizedBody,
            provider: "local",
            [CREATED_BY_ATTRIBUTE]: admin.id,
            [UPDATED_BY_ATTRIBUTE]: admin.id,
        };
        user.email = lodash_1.default.toLower(user.email);
        if (!user.role) {
            const defaultRole = await strapi
                .query("plugin::users-permissions.role")
                .findOne({ where: { type: advanced.default_role } });
            user.role = defaultRole.id;
        }
        try {
            const data = await strapi
                .service("plugin::content-manager.entity-manager")
                .create(user, userModel);
            const sanitizedData = await pm.sanitizeOutput(data, {
                action: ACTIONS.read,
            });
            ctx.created(sanitizedData);
        }
        catch (error) {
            throw new ApplicationError(error.message);
        }
    };
    plugin.controllers.contentmanageruser.update = async (ctx) => {
        const { id } = ctx.params;
        const { body } = ctx.request;
        const { user: admin, userAbility } = ctx.state;
        const advancedConfigs = await strapi
            .store({ type: "plugin", name: "users-permissions", key: "advanced" })
            .get();
        const { email, name, password } = body;
        const { pm, entity } = await findEntityAndCheckPermissions(userAbility, ACTIONS.edit, userModel, id);
        const user = entity;
        await validateUpdateUserBody(ctx.request.body);
        if (lodash_1.default.has(body, "password") && !password && user.provider === "local") {
            throw new ValidationError("password.notNull");
        }
        if (lodash_1.default.has(body, "name")) {
            const userWithSameUsername = await strapi
                .query("plugin::users-permissions.user")
                .findOne({ where: { name } });
            if (userWithSameUsername &&
                lodash_1.default.toString(userWithSameUsername.id) !== lodash_1.default.toString(id)) {
                throw new ApplicationError("Name already taken");
            }
        }
        if (lodash_1.default.has(body, "email") && advancedConfigs.unique_email) {
            const userWithSameEmail = await strapi
                .query("plugin::users-permissions.user")
                .findOne({ where: { email: lodash_1.default.toLower(email) } });
            if (userWithSameEmail &&
                lodash_1.default.toString(userWithSameEmail.id) !== lodash_1.default.toString(id)) {
                throw new ApplicationError("Email already taken");
            }
            body.email = lodash_1.default.toLower(body.email);
        }
        const sanitizedData = await pm.pickPermittedFieldsOf(body, {
            subject: pm.toSubject(user),
        });
        const updateData = lodash_1.default.omit({ ...sanitizedData, updatedBy: admin.id }, "createdBy");
        const data = await strapi
            .service("plugin::content-manager.entity-manager")
            .update({ id }, updateData, userModel);
        ctx.body = await pm.sanitizeOutput(data, { action: ACTIONS.read });
    };
    return plugin;
};
