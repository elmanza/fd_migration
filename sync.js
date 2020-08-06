const { RiteWay, Stage } = require('./models');
const { ritewayDB } = require('./config/database');

async function syncTables() {

    await RiteWay.AddressType.sync();
    await RiteWay.State.sync();
    await RiteWay.County.sync();
    await RiteWay.Zipcode.sync();
    await RiteWay.GisCity.sync();
    await RiteWay.CompanyType.sync();
    await RiteWay.Role.sync();
    await RiteWay.Company.sync();
    await RiteWay.User.sync();
    await RiteWay.CarrierDetail.sync();
    await RiteWay.CustomerDetail.sync();
    await RiteWay.DriverDetail.sync();

    
    await RiteWay.PaymentOption.sync();
    await RiteWay.Status.sync();
    await RiteWay.Quote.sync();
    await RiteWay.QuoteSummary.sync();
    await RiteWay.Location.sync();
    await RiteWay.Order.sync();

    await RiteWay.ChatRoom.sync();
    await RiteWay.ChatMessage.sync();
    await RiteWay.ChatRoomUser.sync();

    //await RiteWay.City.sync();

    await RiteWay.ConfigNotificationOption.sync();
    await RiteWay.Event.sync();
    await RiteWay.ConfigNotificationEmiterType.sync();
    await RiteWay.ConfigNotification.sync();
    await RiteWay.ConfigNotificationCompany.sync();
    await RiteWay.CompanyConfigNotificationCustomer.sync();
    await RiteWay.CompanyConfigNotificationDriver.sync();
    await RiteWay.CompanyConfigNotificationOption.sync();
    
    await RiteWay.AssociatedConfigNotificationOption.sync();
    await RiteWay.ContactInformation.sync();
    await RiteWay.CurrentPosition.sync();
    await RiteWay.DriverDocument.sync();

    await RiteWay.EmailNotifications.sync();
    await RiteWay.EmailList.sync();

    await RiteWay.FavoriteOrder.sync();
    await RiteWay.HistoryTruck.sync();
    await RiteWay.InvoiceType.sync();
    await RiteWay.Invoice.sync();
    await RiteWay.InvoiceFollower.sync();
    await RiteWay.Issue.sync();
    await RiteWay.IssueFollower.sync();
    await RiteWay.MacropointNotification.sync();
    await RiteWay.Note.sync();
    await RiteWay.NoteDocument.sync();

    await RiteWay.NotificationRoom.sync();
    await RiteWay.Notification.sync();

    await RiteWay.OrderDocument.sync();
    await RiteWay.OrderFollower.sync();
    await RiteWay.OrderStatusLog.sync();
    await RiteWay.Payment.sync();
    await RiteWay.QuoteFollower.sync();
    await RiteWay.QuoteTemplate.sync();
    await RiteWay.SeenNote.sync();
    await RiteWay.StatusMacropoint.sync();
    await RiteWay.TrackingHistory.sync();
    await RiteWay.TypeAddress.sync();
    await RiteWay.UserNotification.sync();
    await RiteWay.VehicleMaker.sync();
    await RiteWay.VehicleModel.sync();
    await RiteWay.VehicleType.sync();
    await RiteWay.Vehicle.sync();

    await Stage.FdCompanies.sync();
    await Stage.Log.sync();
    await Stage.MigratedCompany.sync();
    await Stage.OperatorUser.sync();
    await Stage.StageQuote.sync();
    await Stage.CityNotFound.sync();
}

syncTables();