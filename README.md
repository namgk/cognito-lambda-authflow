# Cognito-based front-end + api gateway API auth flow.

## Auth flow

* Front end is hosted at example.com. APIs are hosted at api.example.com.

* Users go to example.com, front-end checks the access to an authorization path, redirect user to Cognito's login UI (e.g. login.example.com).

* Cognito redirect back to api.example.com with an authorization code.

* api.example.com set necessasry cookies for authenticated users.

* Front end now can access protected apis.
* Use https://github.com/namgk/api-gateway-authorizer as the authorizer.

## Usage

Create an api gateway at api.example.com.

Create a Cognito pool, point the callback url to api.example.com/whatever.

Create the /whatever route at the api gateway, bind it to this lambda function.

Create an environment variable call "apps" for this function. Value is as follow:

```
{
  "example.com": {
    "cognitoEndpoint": "https://login.example.com",
    "cognitoId": "app client id",
    "cognitoSecret": "app client secret"
  }
}
```
