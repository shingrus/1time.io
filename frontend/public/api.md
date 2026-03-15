**Create Link**
----
  Creates new one-time link with encrypted message.

* **URL**

  /api/unsecSave

* **Method:**

  `POST`

*  **URL Params**

  None

* **Data Params**
  **Content:**
  `{
        secretMessage string,
        duration      int
   }`

duration  - Seconds to store the secret message. Default is 7 days. Maximum is 30 days(30*86400)



* **Success Response:**

  * **Code:** 200
    **Content:**
    `{
        status: "ok",
        newLink : "/v/#12345678"
    }`
To view this message on the site you should concatenate two strings: "https://onetimelink.me" and value of the newLink parameter. For example: https://onetimelink.me/v/#12345678

* **Error Response:**

  * **Code:** 200
    **Content:** `{
        status: "error",
        NewLink: ""
    }`

* **Sample Call:**

  ```shell
   curl -X POST -H 'content-type: application/json' 'https://onetimelink.me/api/unsecSave' -d \
   '{"secretMessage":"test Message"}'
  ```
