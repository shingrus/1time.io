import React, {Component} from "react";
import {Button, FormGroup, FormControl, ControlLabel,} from "react-bootstrap";
import axios from "axios"
import CryptoJS from 'crypto-js'
import {getRandomString, generatePassword, Constants} from '../utils/util';


import "./Container.css";

export default class NewMessage extends Component {
    constructor(props) {
        super(props);

        this.state = {
            secretMessage: "",
            secretKey: "",
            duration: Constants.defaultDuration,
            needOptions:false,
            isLoading: false,
            // generated once here so they don't change on every re-render (e.g. on each keystroke)
            randomPasswords: [generatePassword(), generatePassword(), generatePassword(), generatePassword()],
        };
        this.handleSubmit = this.handleSubmit.bind(this)

    }

    validateForm() {
        return this.state.secretMessage.length > 0;
    }

    handleChange = event => {
        this.setState({
            [event.target.id]: event.target.value
        });
    };

    handleSubmit(event) {
        event.preventDefault();
        this.setState({isLoading: true}); //block button
        let _this = this;

        let randomKey = getRandomString(Constants.randomKeyLen);
        let secretMessage = this.state.secretMessage;
        let duration = parseInt(this.state.duration,10);

        let secretKey = this.state.secretKey + randomKey;

        let encryptedMessage = CryptoJS.AES.encrypt(secretMessage, secretKey);
        let hashedKey = CryptoJS.SHA256(secretKey);

        let payload = {
            secretMessage: encryptedMessage.toString(),
            hashedKey: hashedKey.toString(),
            duration: duration*86400,
        };
        console.log(payload);
        axios.post(Constants.apiBaseUrl + 'saveSecret', payload)
            .then(function (response) {
                console.log(response);
                if (response.data.status === "ok") {
                    let state = {
                        randomString: randomKey,
                        newId: response.data.newId
                    };
                    _this.props.history.push(
                        {
                            pathname: "/new",
                            state: state
                        }
                    );

                }
                else {
                    //TODO show error
                    _this.setState({isLoading: false});
                }
            })
            .catch(function (error) {
                _this.setState({isLoading: false});
                console.log(error);
            });
    }


    render() {
        return (
            <div className="Left">
                <form onSubmit={this.handleSubmit}>
                    <FormGroup controlId="secretMessage" bsSize="large">
                        <ControlLabel>One-time Message</ControlLabel>
                        <FormControl
                            autoFocus
                            componentClass="textarea"
                            placeholder="All content will be encrypted with the uniq key on the client side."
                            rows={4}
                            value={this.state.secretMessage}
                            onChange={this.handleChange}
                        />
                    </FormGroup>
                    {this.state.needOptions ?
                        <FormGroup><ControlLabel aria-describedby="keyHelp">Additional Secret Key:</ControlLabel>
                            <FormControl id="secretKey"
                                placeholder="Secret Key"
                                value={this.state.secretKey}
                                onChange={this.handleChange}
                                type="text"
                            /><ControlLabel aria-describedby="DurationHelp">Keep message for: </ControlLabel>
                            <FormControl componentClass="select" id="duration"  value={this.state.duration} onChange={this.handleChange}>
                                <option value="1">1 day</option>
                                <option value="3">3 days</option>
                                <option value="7">7 days</option>
                                <option value="30">30 days</option>
                            </FormControl></FormGroup>: null}

                    <FormGroup className="block">
                        <Button
                            className=""
                            bsStyle="default"
                            onClick={(event) => {
                                this.setState({needOptions: !this.state.needOptions})
                            }}
                        >Options
                        </Button>
                        <Button
                            className="pull-right"
                            bsStyle="success"
                            bsSize="large"
                            disabled={!this.validateForm() || this.state.isLoading}
                            type="submit"
                        >
                            {!this.state.isLoading ? "Get a link" : "Loading..."}
                        </Button></FormGroup>
                    <FormGroup>
                        <div className="small">For your convenience, here are a few strong random passwords:<br/>
                            {this.state.randomPasswords[0]}<br/>
                            {this.state.randomPasswords[1]}<br/>
                            {this.state.randomPasswords[2]}<br/>
                            {this.state.randomPasswords[3]}
                        </div>
                        <FormControl.Static className="small">Send passwords, one-time tokens, private messages or any sensitive
                            data with
                            strongly encrypted one-time link. When the user opens the link content is destroyed. It's
                            absolutely private. We don't have access to the stored data, because it's encrypted on the
                            client side with one-time password. The link available only for 7 days.</FormControl.Static>
                    </FormGroup>
                </form>
            </div>
        );
    }
}