const City = require('./city');
const Company = require('./company');
const Document = require('./document');
const Invoice = require('./invoice');
const Issue = require('./issue');
const Order = require('./order');
const Quote = require('./quote');
const State = require('./state');
const User = require('./user');
const Vehicle = require('./vehicle');
const VehicleMaker = require('./vehicleMaker');
const VehicleModel = require('./vehicleModel');
const VehicleType = require('./vehicleType');
const Note = require('./note');

const StageQuote = require('../Stage/quote');

City.belongsTo(State, {
    foreignKey: {
        name: 'state_id',
        allowNull: false
    },
    constraints: true
}); //adds orderId attribute to document

Document.belongsTo(Issue, {
    foreignKey: {
        name: 'issue_id',
        allowNull: false
    },
    constraints: true
}); //adds order_id attribute to document

Invoice.belongsTo(Order, {
    foreignKey: {
        name: 'order_id',
        allowNull: false
    },
    constraints: true
}); //adds order_id attribute to document

Issue.belongsTo(Order, {
    foreignKey: {
        name: 'order_id',
        allowNull: false
    },
    constraints: true
}); //adds order_id attribute to document

Issue.hasMany(Document, {
    foreignKey: {
        name: 'issue_id',
        allowNull: false
    },
    constraints: true
}); //adds issue_id attribute to document

Order.belongsTo(Quote, {
    foreignKey: {
        name: 'quote_id',
        allowNull: false
    },
    constraints: true
}); //adds quoteID attribute to document

Order.belongsTo(User, {
    foreignKey: {
        name: 'user_accept_id',
        allowNull: false
    },
    as: 'userAccept',
    constraints: true
}); //adds userAcceptID attribute to document

Order.hasMany(Issue, {
    foreignKey: {
        name: 'order_id',
        allowNull: false
    },
    constraints: true
}); //adds order_id attribute to issue

Order.hasOne(Invoice, {
    foreignKey: {
        name: 'order_id',
        allowNull: false
    },
    constraints: true
}); //adds order_id attribute to invoice


/** Company, City and User relations
 * By: Nicolas Reyes
**/
Quote.belongsTo(Company, {
    foreignKey: {
        name: 'company_id',
        allowNull: false
    },
    constraints: true
}); //adds companyID attribute to document

Quote.belongsTo(User, {
    foreignKey: {
        name: 'user_create_id',
        allowNull: false
    },
    constraints: true
}); //adds userCreateID attribute to document

Quote.belongsTo(City, {
    foreignKey: {
        name: 'origin_city',
        allowNull: false
    },
    as: 'originCity',
    constraints: true
}); //adds origin_city attribute to document

Quote.belongsTo(City, {
    foreignKey: {
        name: 'destination_city',
        allowNull: false
    },
    as: 'destinationCity',
    constraints: true
}); //adds orderId attribute to document

Quote.hasMany(Vehicle, {
    foreignKey: {
        name: 'quote_id',
        allowNull: false
    },
    constraints: true
});

Quote.hasOne(Order, {
    foreignKey: {
        name: 'quote_id',
        allowNull: false
    },
    constraints: true
});

User.belongsTo(Company, {
    foreignKey: 'company_id',
    constraints: true
});

Vehicle.belongsTo(Quote, {
    foreignKey: {
        name: 'quote_id',
        allowNull: false
    },
    constraints: true
});

Vehicle.belongsTo(VehicleModel, {
    foreignKey: {
        name: 'model_id',
        allowNull: false
    },
    constraints: true
});

Vehicle.belongsTo(VehicleType, {
    foreignKey: {
        name: 'type_id',
        allowNull: false
    },
    constraints: true
});

VehicleModel.belongsTo(VehicleMaker, {
    foreignKey: {
        name: 'maker_id',
        allowNull: false
    },
    constraints: true
});

Note.belongsTo(Order, {
    constraints: true
});

Note.belongsTo(User, {
    constraints: true
});

Order.hasMany(Note, {
    constraints: true
}); //adds userAcceptID attribute to document

Company.belongsTo(User, {
    foreignKey: {
        name: 'operator_id',
        allowNull: false
    },
    constraints: false,
    as:'operatorUser'
});

//====================
Quote.hasOne(StageQuote, {
    foreignKey: 'rite_way_id',
    as: 'stage_quote',
    constraints: true
});

StageQuote.belongsTo(Quote, {
    foreignKey: {
        name: 'rite_way_id',
        allowNull: false
    },
    constraints: false,
});

module.exports = {
    Company,
    User,
    Quote,
    VehicleMaker,
    VehicleModel,
    VehicleType,
    Vehicle,
    City,
    State,
    Order,
    Invoice,
    Issue,
    Document,
    Note
};