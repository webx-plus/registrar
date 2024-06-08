const {Schema, model, SchemaTypes: {Mixed}} = require("mongoose");

const tokenSchema = new Schema({
    _id: {type: String, required: true},
    token: {type: String, required: true},
    expires_at: {type: Date, required: true},
    created_at: {type: Date, default: Date.now},
    ip: {type: String, required: true},
});

const schema = new Schema({
    _id: {type: String, required: true},
    email: {type: String, required: false},
    email_verified: {type: Boolean, default: false},
    email_verification: {
        token: {type: String, required: true},
        code: {type: String, required: true},
        update_address: {type: String, required: false},
    },
    username: {type: String, required: true},
    password: {type: String, required: true},
    tokens: {type: [tokenSchema], default: []},
    created_at: {type: Date, default: Date.now},
    suspended: {type: Boolean, default: false},
    network_admin: {type: Boolean, default: false},
    reserved_tlds: {type: [String], default: []},
    owned_domains: {type: [String], default: []},
});
module.exports = model("users", schema);