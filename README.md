# WCF Truco

WCF Truco is an application that allows people to collectively estimate story
points for planning sessions. It works on top of the
[WebCLIFramework](https://github.com/alnvdl/wcf).

## Installing
1. Go to your WCF folder and run:
    ```sh
    $ npm install https://gitlab.com/alnvdl/wcf_truco
    ```

2. Edit the `config.json` file in your WCF folder and include this module in
the `apps` settting:
    ```json
    {
        ...
        "apps": [
            ...,
            "wcf_truco/truco"
        ]
    }
    ```

3. Restart the server and use the `truco` application. Try the `truco help`
command to learn more about what can be done. You will need to login (using the
`login` application) before using any useful `truco` functionality.

In order to use the `login` application, you'll need to create some users
before. See the [WebCLIFramework](https://github.com/alnvdl/wcf) documentation
to learn how to do that.

## ToDo
The author believes this software is perfect because he wrote it himself. But
that might not be true. So pull requests are welcome.
