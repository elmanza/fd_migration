const containerEmail = (content) => {
   return`
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
  <!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width">
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--<![endif]-->
  <title></title>
  <!--[if !mso]><!-->
  <!--<![endif]-->
  <style type="text/css">
     body {
        margin: 0;
        padding: 0;
     }
     .card__email{
         background-color: #ffffff;
         max-width: 700px;
         width: 100%;
         margin: 0px auto;
     }
     .header__card__email{
         background-color: #025BB7;
         height: 128px;
         margin: 0px;
         text-align: center;
         width: 100%;
         position:relative;
         display: table;
      }
      .header__card__email img{
         min-width: 200px;
         max-width: 360px;
         width: 100%;
         right: 0px;
         left: 0px;
         margin: 0px auto;
         position: absolute;
         top: 50%;
         -ms-transform: translateY(-50%);
         transform: translateY(-50%)
      }
     .content__text__card__email h3{
         font-family: Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif;
         color: #003188;
         font-size: 21px;
         margin: 40px 0px 21px;
     }
     .content__text__card__email p{
	    font-family: Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif;
	    text-align: justify;
	    line-height: 1.5;
	    word-break: break-word;
	    font-size: 14px;
	    color: #6d89bc;
     }
     .small__text p{
      font-size: 13px;
     }
     .small__text p a{
        text-decoration:none;
        font-size: 13px;
     }
     * {
        line-height: inherit;
     }

     a[x-apple-data-detectors=true] {
        color: inherit !important;
        text-decoration: none !important;
     }
     .bestimg{
        width: 60%;
        max-width: 640px;
        min-width: 200px;
        margin-bottom: 30px;
        margin-top: 20px;
     }
     .body__card__email{padding:0px 30px;}
     .btn__card__email{
         text-decoration: none;
         display: inline-block;
         color: #ffffff !important;
         background-color: #fb5f3d;
         border-radius: 60px;
         border-top: 1px solid #fb5f3d;
         border-right: 1px solid #fb5f3d;
         border-bottom: 1px solid #fb5f3d;
         border-left: 1px solid #fb5f3d;
         font-family: Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif;
         word-break: keep-all;
         padding: 15px 30px;
         outline: none;
         margin: 0px auto;
     }
     
  </style>
  <style type="text/css" id="media-query">
     @media (max-width: 660px) {
		}
  </style>
</head>

<body class="clean-body" style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; background-color: #f1f4f8;">
	<div class="cont__email" style="background-color: #f1f4f8;min-width: 320px;width: 100%;height: auto;padding: 30px;">
		<div class="card__email">
			<div class="header__card__email">
            <div style="vertical-align: middle; display: inline-block; display: table-cell;">   
               <img border="0" src="http://development.ritewayportal.com/assets/images/logos/rite-way-auto-transport.png" alt="Rite Way logo" title="Rite Way logo" style="text-decoration: none; -ms-interpolation-mode: bicubic; border: 0; height: auto; display: block;">
            </div>
         </div>
			<div class="body__card__email">
            <div class="content__text__card__email">
               ${content}
				</div>
			</div>
		</div>
	</div>
</body>

</html>
`;
   }

module.exports = {
   containerEmail
}