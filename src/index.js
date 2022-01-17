import "@babel/polyfill";
import fetch from 'node-fetch';
import querystring from 'querystring';

const apps = JSON.parse(process.env.apps);

const asyncHandler = async (event) => {
  console.log(event)
  let { queryStringParameters, multiValueQueryStringParameters, requestContext, rawPath, multiValueHeaders, path } = event;

  let { code, logout: lo, refresh } = queryStringParameters || multiValueQueryStringParameters;
  let { domainName, elb } = requestContext;
  
  if (elb) {
    const { host } = multiValueHeaders;
    domainName = host[0];
    rawPath = path;
    code = code ? code[0] : null;
    lo = lo ? lo[0]: null;
    refresh = refresh ? refresh[0] : null;
  }

  const APP_DOMAIN = domainName.substring(domainName.indexOf('.') + 1);

  const COGNITO_CLIENT_ID = apps[APP_DOMAIN].cognitoId;
  const COGNITO_CLIENT_SECRET = apps[APP_DOMAIN].cognitoSecret;
  const COGNITO_ENDPOINT = apps[APP_DOMAIN].cognitoEndpoint;
  const COGNITO_CALLBACK_URL = `https://${domainName}${rawPath}`;

  const COGNITO_LOGIN_URL = `${COGNITO_ENDPOINT}/login?` +
    `client_id=${COGNITO_CLIENT_ID}&` + 
    `redirect_uri=${COGNITO_CALLBACK_URL}&` + 
    "response_type=code&" +
    "scope=openid";

  const COGNITO_LOGOUT_URL = `${COGNITO_ENDPOINT}/logout?` +
  `client_id=${COGNITO_CLIENT_ID}&` + 
  `logout_uri=https://${APP_DOMAIN}`;

  const COGNITO_TOKEN_ENDPOINT = `${COGNITO_ENDPOINT}/oauth2/token`

  const login = elb ? {
    statusCode: 307,
    statusDescription: 'Found',
    multiValueHeaders: {
      location: [COGNITO_LOGIN_URL],
    }
  } : {
    statusCode: 307,
    statusDescription: 'Found',
    headers: {
      location: COGNITO_LOGIN_URL,
    }
  };

  const logout = elb ? {
    statusCode: 307,
    multiValueHeaders: {
      location: [COGNITO_LOGOUT_URL],
      "Set-Cookie": [`refresh_token=deleted; expires=${new Date(0).toUTCString()}`, `id_token=deleted; expires=${new Date(0).toUTCString()}`, `access_token=deleted; expires=${new Date(0).toUTCString()}`]
    }
  }: {
    statusCode: 307,
    cookies: [`refresh_token=deleted; expires=${new Date(0).toUTCString()}`, `id_token=deleted; expires=${new Date(0).toUTCString()}`, `access_token=deleted; expires=${new Date(0).toUTCString()}`],
    headers: {
      location: COGNITO_LOGOUT_URL,
    }
  }
  
  if(lo) {
    return logout;
  }
  
  if(!code && !(refresh && event.cookies)) {
    console.log("not logged in");
    return login;
  }
   
  let result;
  
  // exchange code or refresh_token
  try {
    const request = {
      client_id: COGNITO_CLIENT_ID,
      client_secret: COGNITO_CLIENT_SECRET,
      redirect_uri: COGNITO_CALLBACK_URL,
    };

    if (refresh && event.cookies){
      // grab the refresh_token from cookie
      const refresh_token = event.cookies.filter(c => c.startsWith("refresh_token="))[0].split("=")[1];
      request["grant_type"] = "refresh_token";
      request["refresh_token"] = refresh_token;
    } else {
      request["grant_type"] = "authorization_code";
      request["code"] = code;
    }

    const resultStr = await fetch(COGNITO_TOKEN_ENDPOINT, {
      method: 'POST',
      body: querystring.stringify(request),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    result = await resultStr.json();
    
  } catch(e){
    console.log("invalid cognito materials");
    console.log(e);
    return login;
  }
  
  console.log(result);
  const { id_token, access_token, refresh_token } = result;

  if (!id_token || !access_token){
    console.log("invalid auth code");
    return login;
  }

  const cookies = [`id_token=${id_token}; Domain=${APP_DOMAIN}; Secure; HttpOnly`, `access_token=${access_token}; Domain=${APP_DOMAIN}; Secure; HttpOnly`]

  if (refresh_token){
    cookies.push(`refresh_token=${refresh_token}; Secure; HttpOnly`);
  }

  if (elb){
    return {
      isBase64Encoded: false,
      statusCode: 307,
      multiValueHeaders: {
        location: [`https://${APP_DOMAIN}`],
        "Set-Cookie": cookies
      }
    }
  }

  // set id_token as cookie
  return {
    statusCode: 307,
    cookies,
    headers: {
      location: `https://${APP_DOMAIN}`,
    }
  };
};

export default { asyncHandler };
