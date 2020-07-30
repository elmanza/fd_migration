module.exports = {
    quoteStatusChange(quote) {
        return {
            name: 'quoteStatusChange',
            updateComponent: {
                eventName: `quote`
            },
            notification: {
                send: true,
                text: `Quote ${quote.fd_number} has change status`,
                sendTo: ["jeff", "raimundo", "creator", "operator"]
            },
            email: {
                send: false
            }
        }
    },
    orderStatusChange(quote) {
        return {
            name: 'orderStatusChange',
            updateComponent: {
                eventName: `order`
            },
            notification: {
                send: true,
                text: `Order ${quote.fd_number} has change status`,
                sendTo: ["jeff", "raimundo", "creator", "operator"]
            },
            email: {
                send: false
            }
        }
    },
    newQuote(quote) {
        return {
            name: 'newQuote',
            updateComponent: {
                eventName: `quote`
            },
            notification: {
                send: true,
                text: `Quote ${quote.fd_number} has been created`,
                sendTo: ["jeff","raimundo","creator","operator"]
            },
            email: {
                send: true
            }
        }
    }
}