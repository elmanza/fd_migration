const QUOTE_STATUS = {
    WAITING: 1,
    OFFERED: 2,
    ORDERED: 3,
    CANCELLED: 13
}

const ORDER_STATUS = {
    ACTIVE: 23,
    POSTED: 5,
    NOTSIGNED: 6,
    SIGNED: 7,
    PICKEDUP: 8,
    DISPATCHED: 15,
    INTRANSIT_ONTIME: 9,
    INTRANSIT_DELAY: 10,
    DELIVERED: 11,
    DAMAGE: 12,
    CANCELLED: 13,
    ONHOLD: 17
}

//ACTIVE/MyOrder = 1, ONHOLD = 2, ARCHIVED/CANCELLED = 3, POSTED = 4, NOTSIGNED = 5, DISPATCHED = 6, ISSUES = 7, PICKEDUP = 8, DELIVERED = 9 

const FD_STATUS = {
    LEAD: 21,
    ACTIVE: 1,
    ONHOLD: 2,
    CANCELLED: 3,
    POSTED: 4,
    NOTSIGNED: 5,
    DISPATCHED: 6,
    ISSUES: 7,
    PICKEDUP: 8,
    DELIVERED: 9
}

const ADDRESS_TYPE = {
    COMMERCIAL: 1,
    RESIDENTIAL: 2
}

const COMPANY_TYPES = {
    CARRIER: 1,
    CUSTOMER: 2,
    RITE_WAY: 3
}

const ROLES = {
    SUPER_ADMIN: 1,
    OPERATOR: 8,
    CUSTOMER: 4,
    CARRIER: 5,
    CUSTOMER_ADMIN: 12,
    DRIVER: 15
}

const INVOICE_TYPES = {
    CUSTOMER: 1,
    CARRIER: 2
}

module.exports = {
    QUOTE_STATUS,
    ORDER_STATUS,
    FD_STATUS,
    ADDRESS_TYPE,
    COMPANY_TYPES,
    ROLES,
    INVOICE_TYPES
};