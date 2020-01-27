class RiteWayAutotranportService{
    constructor(){
        this.memberResource = new MemberResource();
        this.entityResource = new EntityResource();
    }

    parseFDData(FDEntity){
        let rwData = {};
        return rwData;
    }

    async getRWCity(stateAbbre, cityName){
        let citySQL = `
                SELECT city.*
                FROM cities
                INNER JOIN states on cities.state_id = states.id
                WHERE states.abbreviation ilike '${stateAbbre}' and cities.name = '${cityName}'
            `;
        return await ritewayDB.query(citySQL, { type: ritewayDB.QueryTypes.SELECT});
    }

    async createUser(fdOperator){        
        let riteWayOperator = await riteWay.User.findOne({
            where: {
                username:fdOperator.email
            }
        });

        if(!riteWayOperator){
            let name = fdOperator.contactname.split(' ');                 

            riteWayOperator = await riteWay.User.create({
                name: name[0],
                last_name: name.slice(1).join(' '),
                username: fdOperator.email,
                password: '',
                photo: '',
                phone: fdOperator.phone,
                shipper_type: '',
                is_company_admin: false,
                isOperator: true,
                company_id: null
            });
        }

        return riteWayOperator;
    }

    importQuote(FDEntity){
        let rwData = this.parseFDData(FDEntity);
    }
}