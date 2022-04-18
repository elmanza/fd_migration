

const moment = require('moment');
const Sequelize = require('sequelize');
const sqOp = Sequelize.Op;
const fs = require('fs')
const path = require('path');

const RiteWayAutotransportSyncService = require('../rite_way/services/RiteWayAutotransportSyncService');
const FreightDragonService = require('../freight_dragon/services/FreightDragonService');

const { RiteWay, Stage } = require('../../models');
const { ritewayDB } = require('../../config/database');
const RwSyncService = new RiteWayAutotransportSyncService();
const FDService = new FreightDragonService();

const Logger = require('../../utils/logger');

async function migrate(companyId, today = false) {
    let from = '2010-01-01';
    let to = moment().format('YYYY-MM-DD');

    let conditions = [
        Sequelize.where(
            Sequelize.col('FdCompanies.company_id'),
            '=',
            companyId
        )
    ];

    if (today) {
        from = moment().subtract(15, 'days').format('YYYY-MM-DD');
        conditions.push(
            Sequelize.where(
                Sequelize.col('MigratedCompany.migrated'),
                '=',
                true
            )
        );
    }
    else {
        conditions.push(
            Sequelize.where(
                Sequelize.col('MigratedCompany.id'),
                '=',
                null
            )
        );
    }

    let fdCompanies = await Stage.FdCompanies.findAll({
        include: [
            {
                model: Stage.MigratedCompany,
                require: false
            },
            {
                model: RiteWay.Company,
                include: {
                    model: RiteWay.CustomerDetail,
                    required: true,
                    as: 'customerDetail'
                }
            }
        ],
        where: {
            [sqOp.and]: conditions
        }
    });

    for (const fdCompany of fdCompanies) {
        let migration;
        let company = fdCompany.Company;

        if (fdCompany.MigratedCompany) {
            migration = fdCompany.MigratedCompany;
            migration = await migration.update({
                status: '',
                startedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                finishedAt: null
            });
        }
        else {
            migration = await Stage.MigratedCompany.create({
                fd_company_id: fdCompany.id,
                status: '',
                startedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                migrated: false
            });
        }

        let res = await FDService.getList(`${from} 00:00:00`, `${to} 23:59:59`, fdCompany.name.trim());
        let ok = 0;
        let fail = 0;
        let exists = 0;
        if (res.Success) {
            Logger.info(`Migration of ${fdCompany.name.trim()}. Total Entities: ${res.Data.length} Between ${from} to ${to}`);
            for (let [i, FDEntity] of res.Data.entries()) {
                let message = `Index ${i} FDOrderID ${FDEntity.FDOrderID} ${((i + 1) / res.Data.length * 100).toFixed(6)}%`;
                // console.log("FDEntity...................>",FDEntity);
                try {
                    let success = await RwSyncService.importFDEntity(FDEntity, company);
                    if (success) {
                        Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}`);
                        ok++;
                    }
                    else {
                        Logger.info(`Not imported  (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}`);
                        exists++;
                    }
                }
                catch (e) {
                    Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}: ${e.message}`);
                    Logger.error(e);
                    fail++;
                    let contentFile = `${FDEntity.FDOrderID}: ${e.message} </br> ------------------- ${JSON.stringify(e)} ----------------------------- Final de la entidad -----------------------------`;
                    let appFolder = path.dirname(require.main ? require.main.filename : __dirname);
                    fs.writeFile(`${appFolder}/logs_migration/debugger-${fdCompany.name.trim()}.txt`, `${contentFile} \n \n \n \n \n`, { flag: 'a+' }, err => {
                        console.log("ERROR EN MI debugger.txt", err);
                    })
                }

                await migration.update({
                    status: message,
                    ok,
                    fail,
                    exists
                });
            }

            await migration.update({
                status: `Migration of ${fdCompany.name}. Total Entities: ${res.Data.length}. OK ${ok},  FAIL ${fail}`,
                finishedAt: moment().format('YYYY-MM-DD hh:mm:ss'),
                migrated: true
            });
        }

    }
}

async function migrateTodayEntities(companyId) {
    return migrate(companyId, true);
}

async function migrateOperators() {
    let res = await FDService.getMemberList();

    if (res.Success) {
        for (const fdOperator of res.Data) {
            let plainPassoword = Math.random().toString(36).slice(2);
            let name = fdOperator.contactname.split(' ');
            let userData = {
                name: name[0],
                last_name: name.slice(1).join(' '),
                username: fdOperator.email.trim().toLowerCase(),
                photo: '',
                phone: fdOperator.phone,
                company_id: null
            };

            let operatorUser = await RwSyncService.getUser(userData, plainPassoword);
        }
    }
}
let migrando = null;
async function migrateCustomeData(){
    if(migrando == null){
        migrando = true;
        console.log("ADENTRO DE migrateCustomeData");
    
        // let from = '2018-07-01';
        // let to = '2018-07-03';

        // let from = '2018-07-04';
        // let to = '2018-07-06';

        // let from = '2018-07-07';
        // let to = '2018-07-09';

        // let from = '2018-07-10';
        // let to = '2018-07-12';

        // let from = '2018-07-13';
        // let to = '2018-07-15';

        // let from = '2018-07-16';
        // let to = '2018-07-19';

        // let from = '2018-07-20';
        // let to = '2018-07-22';

        // let from = '2018-07-23';
        // let to = '2018-07-25';

        // let from = '2018-07-26';
        // let to = '2018-07-28';

        let from = '2022-04-05';
        let to = '2022-04-08';


        // let from = '2022-02-15';
        // let to = '2022-02-31';


        console.log("fecahas ",from , to);
        // let to = moment().format('YYYY-MM-DD');
        try {
            //let orders = ["7RB-600245","0VQ-600841","9MN-607785","2GA-613504","6TN-621710","6IQ-633334","8TZ-650862","2VI-650881","7ZC-653146","7VJ-666825","2HB-667056","6KL-704983","8XP-718466","7SX-720638","7ZE-724961","7NY-726714","1VG-727073","7IN-727247","3CP-727313","4ZE-729120","6YU-729322","5TK-736643","1TJ-736869","0PF-739014","7SM-739153","2IB-739344","6DP-739476","8UX-739771","1ZX-739865","5EY-739881","9PT-740073","2VA-741181","0VV-742081","7XZ-742698","8EB-750391","3DE-751011","5IY-751180","9FA-751291","5YD-751390","5DP-752172","7RA-752267","7MF-753156","3UP-753222","5CN-758641","1JQ-761534","3CE-763376","0NI-763994","0GQ-764309","4PB-764506","2CF-766442","8BX-766732"];
            //, "8NT-766624"
            // let orders = ["5XK-766331"];
            // let res = await FDService.getCustomeData(`${from} 00:00:00`, `${to} 23:59:59`);
            // let request = [];
            // for (const fd_number of orders) {
            //     request.push(FDService.get(fd_number));
            // }
            // let result = await Promise.all(request);
            // console.log("-------");
            // console.log(result);
            // let res = await FDService.get(`${from} 00:00:00`, `${to} 23:59:59`);
            let res = await FDService.getCustomeData(`${from} 00:00:00`, `${to} 23:59:59`);
            let ok = 0;
            let fail = 0;
            let exists = 0;
            let no_migradas = [];
            let fail_arr = [];
            console.log("-----------------------------------> ",res.Data.length);
            // for (const res of result) {
                if (res.Success) {
                    // Logger.info(`Migration of ${from} to ${to}.  Total Entities: ${res.Data.length} Between ${from} to ${to}`);
                    for (let [i, FDEntity] of res.Data.entries()) {
                        let message = `Index ${i} FDOrderID ${FDEntity.FDOrderID} ${((i + 1) / res.Data.length * 100).toFixed(6)}%`;
                            console.log("-----------------------> ",message);
                        try {
                            // console.log("kajbsdjkabsdj --->> ", res.Data);
                            // let success = res.Data.origin.state ? await RwSyncService.importFDEntity(FDEntity, null) : false;
                            // let success = await RwSyncService.importFDEntity(res.Data[0], null)
                            let success = await RwSyncService.importFDEntity(FDEntity, null)
                            // console.log("--------------RwSyncService---------> ", success);
                            if (success) {
                                console.log("-------success----------------> ");
                                Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}`);
                                ok++;
                            }
                            else {
                                // no_migradas.push(`${res.Data.prefix}-${res.Data.number}`)
                                console.log("-------error----------------> ");
                                Logger.info(`Not imported  (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}`);
                                exists++;
                            }
                        }catch (e) {
                            console.log("-------catch----------------> ");
                            Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${FDEntity.FDOrderID}: ${e.message}`);
                            Logger.error(e);
                            // fail_arr.push(`${res.Data.prefix}-${res.Data.number}`);
                            fail_arr.push(`${FDEntity.FDOrderID}`);
                            fail++;
                            // let contentFile = `${FDEntity.FDOrderID}: ${e.message} </br> ------------------- ${JSON.stringify(e)} ----------------------------- Final de la entidad -----------------------------`;
                            // let appFolder = path.dirname(require.main ? require.main.filename : __dirname);
                            // let nameDoc = FDEntity.shipper.company == "" || FDEntity.shipper.company == null ? FDEntity.shipper.entity_id : FDEntity.shipper.company.trim();
                            // fs.writeFile(`${appFolder}/logs_migration_by_for_feb_08_22/debugger-${nameDoc}.txt`, `${contentFile} \n \n \n \n \n`, { flag: 'a+' }, err => {
                                //console.log("ERROR EN MI debugger.txt", err);
                            // })
                        }
    
                    }
                }
            // }

            console.log(`{from:${from}, to${to}: } <--> ok:${ok}  || fail:${fail}  || sin_state:${exists}`)
            console.log("No migradas ");
            console.log(fail_arr);
        } catch (error) {
            console.log("migrateCustomeData", error);
        }
    }
        
}




async function migrateCustomeDataByFDNumbers(){
    if(migrando == null){
        migrando = true;
        console.log("ADENTRO DE migrateCustomeData 22222222222222222222222222222");
        let from = '2021-03-01';
        let to = '2021-06-01';
        // let to = moment().format('YYYY-MM-DD');
        try {
            
            let orders = [
                '7AK-768081',
                '6GS-768362',
                '4GP-768708',
                '4LE-769245', '2RO-769268', '6QQ-769279', '4FY-769281'
              ];
            // let res = await FDService.getCustomeData(`${from} 00:00:00`, `${to} 23:59:59`);
            let request = [];
            for (const fd_number of orders) {
                request.push(FDService.get(fd_number));
            }
            let result = await Promise.all(request);
            console.log("-------");
            console.log(result);
            // let res = await FDService.get(`${from} 00:00:00`, `${to} 23:59:59`);
            let ok = 0;
            let fail = 0;
            let exists = 0;
            let no_migradas = [];
            let fail_arr = [];
            for (const res of result) {
                if (res.Success) {
                    Logger.info(`Migration of ${from} to ${to}.  Total Entities: ${res.Data.length} Between ${from} to ${to}`);
                    // for (let [i, FDEntity] of res.Data.entries()) {
                        // let message = `Index ${i} FDOrderID ${res.Data.FDOrderID} ${((i + 1) / res.Data.length * 100).toFixed(6)}%`;
                            // console.log("-----------------------> ",message);
                        try {
                            // console.log("kajbsdjkabsdj --->> ", res.Data);
                            // let success = res.Data.origin.state ? await RwSyncService.importFDEntity(res.Data, null) : false;
                            let success = await RwSyncService.importFDEntity(res.Data[0], null)
                            console.log("--------------RwSyncService---------> ", success);
                            if (success) {
                                console.log("-------success----------------> ");
                                // Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${res.Data.FDOrderID}`);
                                ok++;
                            }
                            else {
                                no_migradas.push(`${res.Data[0].prefix}-${res.Data[0].number}`)
                                console.log("-------error----------------> ");
                                // Logger.info(`Not imported  (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${res.Data.FDOrderID}`);
                                exists++;
                            }
                        }catch (e) {
                            console.log("-------catch---------------->  FINAL");
                            // Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${res.Data.FDOrderID}: ${e.message}`);
                            Logger.error(e);
                            fail_arr.push(`${res.Data[0].prefix}-${res.Data[0].number}`);
                            fail++;
                            let contentFile = `${res.Data.FDOrderID}: ${e.message} </br> ------------------- ${JSON.stringify(e)} ----------------------------- Final de la entidad -----------------------------`;
                            let appFolder = path.dirname(require.main ? require.main.filename : __dirname);
                            let nameDoc = res.Data[0].shipper.company == "" ? res.Data[0].shipper.entity_id : res.Data[0].shipper.company.trim();
                            console.log(contentFile);
                            // fs.writeFile(`${appFolder}/logs_migration_by_for_feb_08_22/debugger-${nameDoc}.txt`, `${contentFile} \n \n \n \n \n`, { flag: 'a+' }, err => {
                                //console.log("ERROR EN MI debugger.txt", err);
                            // })
                        }
    
                    // }
                }
            }

            console.log(`ok:${ok}  || fail:${fail}  || sin_state:${exists}`)
            console.log("No migradas ");
            console.log(fail_arr);
        } catch (error) {
            console.log("migrateCustomeData", error);
        }
    }
        
}

async function migrateCarriers(){
    if(migrando == null){
        migrando = true;
        try {
            let from = '2021-12-01';
            let to = '2021-12-31';
            let ok = 0;
            let fail = 0;
            let exists = 0;
            let migradas = [];
            let fail_arr = [];
            let res = await FDService.getCarriers(`${from} 00:00:00`, `${to} 23:59:59`);
            let i = 0;
            if (res.Success) {
                console.log("Total de carrier traidos ", res.Data.length);
                for (const fdCarrier of res.Data) {
                    try {
                        // console.log("ADENTOR BROO")
                        let success = await RwSyncService.importFDCarrier(fdCarrier, null)
                        // console.log("--------------RwSyncService---------> ", success);
                        if (success) {
                            console.log("-------success----------------> ");
                            Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdCarrier.company_name} ${fdCarrier.email}`);
                            ok++;
                            migradas.push(`${fdCarrier.email}`);
                        }
                        console.log(success);
                    } catch (e) {
                        console.log("-------catch----------------> ");
                        Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdCarrier.id}: ${fdCarrier.company_name}: ${fdCarrier.email} : ${e.message}`);
                        Logger.error(e);
                        // fail_arr.push(`${res.Data.prefix}-${res.Data.number}`);
                        fail_arr.push(`${fdCarrier.id} || ${fdCarrier.company_name} || ${fdCarrier.email}`);
                        fail++;
                    }
                    i++;
                }
                console.log(`From: ${from} --- To: ${to}`)
                console.log(`ok:${ok}  || fail:${fail} `) 
                console.log("No migradas ");
                console.log(JSON.stringify(fail_arr));

                console.log("Migradas ");
                console.log(JSON.stringify(migradas));
            }           
        } catch (error) {
            console.log("migrateCustomeData", error);
        }
    }
        
}



async function updateReferredCustomer(){
    if(migrando == null){
        migrando = true;
        try {
            let from = '2018-01-01';
            let to = '2022-12-31';
            let ok = 0;
            let fail = 0;
            let exists = 0;
            let no_migradas = [];
            let fail_arr = [];
            let res = await FDService.getReferredCustomer(`${from} 00:00:00`, `${to} 23:59:59`);
            let i = 0;
            if (res.Success) {
                console.log("Total de carrier traidos ", res.Data.length);
                for (const fdCarrier of res.Data) {
                    try {
                        // console.log("ADENTOR BROO") 
                        let success = await RwSyncService.updateReferredCustomer(fdCarrier, null)
                        // console.log("--------------RwSyncService---------> ", success);
                        if (success) {
                            console.log("-------success----------------> ");
                            Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdCarrier.company_name} ${fdCarrier.email}`);
                            ok++;
                        }
                        console.log(success);
                    } catch (e) {
                        console.log("-------catch----------------> ");
                        Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${fdCarrier.id}: ${fdCarrier.company_name}: ${fdCarrier.email} : ${e.message}`);
                        Logger.error(e);
                        // fail_arr.push(`${res.Data.prefix}-${res.Data.number}`);
                        fail_arr.push(`${fdCarrier.id} || ${fdCarrier.company_name} || ${fdCarrier.email}`);
                        fail++;
                    }
                    i++;
                }
                console.log(`From: ${from} --- To: ${to}`)
                console.log(`ok:${ok}  || fail:${fail} `)
                console.log("No migradas ");
                console.log(JSON.stringify(fail_arr));
            }           
        } catch (error) {
            console.log("migrateCustomeData", error);
        }
    }
        
}




async function migrateLeads(){
    if(migrando == null){
        migrando = true;
        try {
            let from = '2019-01-01';
            let to = '2019-12-31';
            let ok = 0;
            let fail = 0;
            let exists = 0;
            let no_migradas = [];
            let fail_arr = [];
            let res = await FDService.getLeads(`${from} 00:00:00`, `${to} 23:59:59`);
            let i = 0;
            if (res.Success) {
                let totalLeads = res.Data.length;
                console.log("Total de Leads traidas ", totalLeads);
                for (const Lead of res.Data) {
                    try {
                        // console.log("ADENTOR BROO") 
                        let success = await RwSyncService.importLeadToLoadGenie(Lead, null)
                        // console.log("--------------RwSyncService---------> ", success);
                        if (success) {
                            console.log("-------success----------------> ");
                            Logger.info(`Sucess import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${Lead.number} ${Lead.company} --> ${(i + 1)} de ${totalLeads}`);
                            ok++;
                        }
                        console.log(success);
                    } catch (e) {
                        console.log("-------catch----------------> ");
                        Logger.error(`Error import (${((i + 1) / res.Data.length * 100).toFixed(6)}%) ${Lead.id}: ${Lead.number}: ${Lead.email} : ${Lead.company}`);
                        Logger.error(e);
                        // fail_arr.push(`${res.Data.prefix}-${res.Data.number}`);
                        fail_arr.push(`${Lead.number}`);
                        fail++;
                    }
                    i++;
                }
                console.log(`From: ${from} --- To: ${to}`)
                console.log(`ok:${ok}  || fail:${fail} `)
                console.log("No migradas ");
                console.log(JSON.stringify(fail_arr));
            }           
        } catch (error) {
            console.log("migrateCustomeData", error);
        }
    }
        
}
function calcPagination(page = 0, pageSize = 20) {
    return {
      limit: pageSize,
      offset: page * pageSize
    };
  }
let syncDispatchSheetOnLeads = true;
async function migrateNotesLead(limit){
    try{
        if(syncDispatchSheetOnLeads){
            syncDispatchSheetOnLeads = false;
            let countQuery = `select
                                COUNT(leads.id) as total
                              from
                                leads
                                left join lead_notes on leads.id = lead_notes.lead_id 
                              where
                                leads.imported is true and lead_notes.id is null
                                and leads."created_at" <= '2015-12-31 05:00:00.000 +00:00' and 
                                leads."created_at" >= '2015-01-01 05:00:00.000 +00:00'`;                            
            let leadsCount = await ritewayDB.query(countQuery, {
                type: ritewayDB.QueryTypes.SELECT
                });
                console.log("laksndklasnd", leadsCount);
            let amountOrders = Number(leadsCount[0].total) || 0;
                if(amountOrders > 0){
                    
                    let totalPage = Math.ceil(amountOrders / limit);
                    let page = 0;
                    let doing = true;          
                    console.log(`Model: Leads get dispatchsheet. BatchSize: ${limit}. Total Pages: ${totalPage}`);
                    while(doing){
                        let promises = [];
                        if(page > totalPage){
                            doing = false;
                            syncDispatchSheetOnLeads = true;
                        }
                        let limitAndOffset = calcPagination(page, limit);
                        let query = `select
                                        SUBSTRING(code, 7, length(code)) as number,
                                        leads.id
                                    from
                                        leads
                                        left join lead_notes on leads.id = lead_notes.lead_id 
                                        where
                                            leads.imported is true and lead_notes.id is null
                                            and leads."created_at" >= '2018-01-01 05:00:00.000 +00:00'
                                            order by leads.created_at desc
                                        limit ${limitAndOffset.limit} offset ${limitAndOffset.offset}`;

                                
                        let leads = await ritewayDB.query(query, {
                            type: ritewayDB.QueryTypes.SELECT
                        });

                        console.log(`Page ${page} de ${totalPage}. VALOR DE doing ${doing}`);
            
                        for (const lead of leads) {
                            promises.push(RwSyncService.migrateNotesLead(lead));
                        }
                        await Promise.all(promises);
                        page++;
                    } 
                    if(syncDispatchSheetOnLeads){
                        return true;
                    }
                }
            return true;
        }
    }catch(err){
        console.log(err);
        return false;
    }
        
}


module.exports = {
    migrate,
    migrateTodayEntities,
    migrateOperators,
    migrateCustomeData,
    migrateCustomeDataByFDNumbers,
    migrateCarriers,
    updateReferredCustomer,
    migrateLeads,
    migrateNotesLead
}