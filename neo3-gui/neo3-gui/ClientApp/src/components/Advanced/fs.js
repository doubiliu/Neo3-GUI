/* eslint-disable */
import React from 'react';
import 'antd/dist/antd.css';
import axios from 'axios';
import {
    Input,
    PageHeader,
    Modal,
    Alert,
    Row,
    Col,
    Tabs,
    Button,
    Card,
    Switch,
    Select,
    List,
    Progress,
    Spin
} from 'antd';
import { Layout } from 'antd';
import { Statistic } from 'antd';
import Sync from '../sync';
import { observer, inject } from "mobx-react";
import { withRouter } from "react-router-dom";
import { withTranslation, Trans } from "react-i18next";
import { RetweetOutlined, EditOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import "../../static/css/advanced.css";
import { Copy } from '../copy';
import { remote } from "electron";

const { dialog } = remote;
const { Option } = Select;
const { Content } = Layout;
const { TabPane } = Tabs;
const { Search } = Input;
const { TextArea } = Input;

@withTranslation()
@inject("walletStore")
@observer
@withRouter
class Fs extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            disabled: true,
            visible: false,
            isOpenDialog: false,
            uploadpath: "",
            downloadpath: "",
            show: false,
            batchDelete: false,
            objecttype: 1,
            tableswitch: 0,
            title: "fs",
            ppublickey: "",
            paccount: "",
            pbalance: 0,
            pcontainerId: "",
            ppolicyString: "",
            pbasicAcl: "",
            pattributesString: "",
            peaclString: "",
            pobjectId: "",
            pobjectIds: "",
            psubIds: "",
            peacl: "",
            pobject: "",
            pobjectdata: "",

            balance: 0,
            epoch: 0,
            nodeinfo: "",
            cid: "",
            containerinfo: "",
            eacl: "",
            object: "",
            containerIds: [],
            objectIds: [],
            tasks: [],
        };
    }

    //Sync epoch
    onEpoch() {
        axios.post('http://localhost:8081', {
            "id": "1",
            "method": "OnGetEpoch",
            "params": {
            }
        })
            .then((response) => {
                var _data = response.data.result;
                this.setState({ epoch: _data });
                return;
            })
            .catch(function (error) {
                console.log(error);
                console.log("error");
            });
    }

    //Sync nodeinfo
    onNodeInfo() {
        axios.post('http://localhost:8081', {
            "id": "1",
            "method": "OnGetLocalNodeInfo",
            "params": {
            }
        })
            .then((response) => {
                var _data = response.data;
                if (_data.msgType === -1) {
                    let res = _data.error;
                    this.setState({ nodeinfo: res.message });
                    return;
                } else if (_data.msgType === 3) {
                    var _data = response.data.result;
                    this.setState({ nodeinfo: _data });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    //relate account
    onAccountBalance() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnAccountBalance",
                "params": {
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.account-query-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        var _data = response.data.result;
                        this.setState({ balance: _data, loading: false });
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    onAccountDeposite() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnAccountDeposite",
                "params": {
                    "pamount": this.state.pbalance,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.account-deposit-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, t("translation:advanced.fs.account-deposit-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    onAccountWithdraw() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnAccountWithdraw",
                "params": {
                    "pamount": this.state.pbalance,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.account-withdraw-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, t("translation:advanced.fs.account-withdraw-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    //relate container
    onGetContainer() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnGetContainer",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    console.log("onGetContainer");
                    console.log(_data);
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.container-query-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ containerinfo: JSON.stringify(response.data.result), loading: false });
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    onListContainer = value => {
        const { t } = this.props;
        this.state.paccount = value;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnListContainer",
                "params": {
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.state.containerIds = [];
                        this.setState({ containerIds: [], loading: false });
                        ModalError(_data, t("translation:advanced.fs.container-list-query-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        console.log(_data.result);
                        this.setState({ containerIds: _data.result, loading: false });
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    onPutContainer() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnPutContainer",
                "params": {
                    "policyString": this.state.ppolicyString,
                    "basicAcl": this.state.pbasicAcl,
                    "attributesString": this.state.pattributesString,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.container-put-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, t("translation:advanced.fs.container-put-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    onDeleteContainer() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnDeleteContainer",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.container-delete-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, t("translation:advanced.fs.container-delete-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    //relate eacl
    onGetContainerEACL() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnGetContainerEACL",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.eacl-query-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        var _data = response.data.result;
                        this.setState({ eacl: JSON.stringify(_data), loading: false });
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    onSetContainerEACL() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnSetContainerEACL",
                "params": {
                    "paccount": this.state.paccount,
                    "eaclString": this.state.peaclString
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.eacl-set-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, t("translation:advanced.fs.eacl-set-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    //relate object
    OnGetObject = objectId => {
        const { t } = this.props;
        this.setState({ pobjectId: objectId, loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnGetObject",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "objectId": this.state.pobjectId,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.object-query-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ object: _data.result, loading: false });
                        if (JSON.parse(_data.result).length != 1) {
                            this.setState({ psubIds: (JSON.parse(_data.result)[1])["subIds"].toString() });
                        }
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    onListObject() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnListObject",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "paccount": this.state.paccount
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.object-list-query-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        console.log(_data.result);
                        this.setState({ loading: false });
                        this.setState({ objectIds: _data.result });
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    onPutObject() {
        const { t } = this.props;
        var flag = this.state.objecttype;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', flag == 1 ? {
                "id": "1",
                "method": "OnPutObject",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "pdata": this.state.pobjectdata,
                    "paccount": this.state.paccount
                }
            } : {
                    "id": "1",
                    "method": "OnStorageGroupObject",
                    "params": {
                        "containerId": this.state.pcontainerId,
                        "pobjectIds": this.state.pobjectIds,
                        "paccount": this.state.paccount
                    }
                })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, flag ? t("translation:advanced.fs.object-put-fault") : t("translation:advanced.fs.object-storagegroup-put-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, flag ? t("translation:advanced.fs.object-put-success") : t("translation:advanced.fs.object-storagegroup-put-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    onDeleteObject() {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": "1",
                "method": "OnDeleteObject",
                "params": {
                    "containerId": this.state.pcontainerId,
                    "pobjectIds": this.state.batchDelete ? this.state.pobjectId + "_" + this.state.psubIds : this.state.pobjectId,
                    "paccount": this.state.paccount,
                }
            })
                .then((response) => {
                    var _data = response.data;
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.object-delete-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(_data, t("translation:advanced.fs.object-delete-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    //relate file
    onUploadFile = (taskId, containerId, uploadpath, timestamp) => {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": 1,
                "method": "OnUploadFile",
                "params": {
                    "taskId": taskId,
                    "containerId": containerId,
                    "filePath": uploadpath,
                    "paccount": this.state.paccount,
                    "timestamp": timestamp,
                }
            })
                .then((response) => {
                    var _data = response.data;
                    console.log(_data);
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.bigfile-upload-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(null, t("translation:advanced.fs.bigfile-upload-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }

    onDownloadFile = (taskId, containerId, objectId, downloadpath, timestamp) => {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "id": 1,
                "method": "OnDownloadFile",
                "params": {
                    "taskId": taskId,
                    "containerId": containerId,
                    "objectId": objectId,
                    "filePath": downloadpath,
                    "paccount": this.state.paccount,
                    "timestamp": timestamp,
                }
            })
                .then((response) => {
                    var _data = response.data;
                    console.log(_data);
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        ModalError(_data, t("translation:advanced.fs.bigfile-download-fault"));
                        return;
                    } else if (_data.msgType === 3) {
                        this.setState({ loading: false });
                        ModalSuccess(null, t("translation:advanced.fs.bigfile-download-success"));
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    }


    onGetProcess = () => {
        const { t } = this.props;
        axios.post('http://localhost:8081', {
            "method": "OnGetProcess",
            "params": {
            }
        })
            .then((response) => {
                var _data = response.data;
                if (_data.msgType === -1) {
                    return;
                } else if (_data.msgType === 3) {
                    this.setState({ tasks: _data.result });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onGetSeedFile = (filePath) => {
        const { t } = this.props;
        this.setState({ loading: true }, () => {
            axios.post('http://localhost:8081', {
                "method": "OnGetFile",
                "params": {
                    "filePath": filePath
                }
            })
                .then((response) => {
                    var _data = response.data;
                    console.log(_data);
                    if (_data.msgType === -1) {
                        this.setState({ loading: false });
                        return;
                    } else if (_data.msgType === 3) {
                        var temp = _data.result.split("_");
                        this.setState({
                            pcontainerId: temp[0],
                            objectIds: [temp[1]],
                            loading: false
                        });
                        return;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        })
    }

    handelChange = (name, value) => {
        this.setState({
            [name]: value
        });
    }

    handelChangeInput = (name, e) => {
        this.setState({
            [name]: e.target.value
        });
    }

    tabParamterClean = (key) => {
        this.setState({
            tableswitch: key,
            ppublickey: "",
            pbalance: 0,
            ppolicyString: "",
            pbasicAcl: "",
            pattributesString: "",
            peaclString: "",
            pobjectId: "",
            pobjectIds: "",
            psubIds: "",
            peacl: "",
            pobject: "",
            pobjectdata: "",
            downloadpath: "",
            uploadpath: "",

            balance: 0,
            epoch: 0,
            nodeinfo: "",
            cid: "",
            containerinfo: "",
            eacl: "",
            object: "",
            objectIds: [],
            containerIds: [],
        })
    }

    switchChange = (checked) => {
        this.setState({
            batchDelete: checked
        })
    }

    selectFile = (flag) => {
        this.opendialog("*", (res) => {
            console.log(res);
            this.setState(flag > 0 ?
                {
                    uploadpath: res.filePaths[0],
                    isOpenDialog: false,
                } :
                {
                    downloadpath: res.filePaths[0].substring(0, res.filePaths[0].length - res.filePaths[0].split('\\')[res.filePaths[0].split('\\').length - 1].length),
                    isOpenDialog: false,
                }, () => {
                    if (flag < 0) this.onGetSeedFile(res.filePaths[0])
                }
            );
        });
    };

    browseDialog = () => {
        const { isOpenDialog } = this.state;
        if (isOpenDialog === false) {
            return false;
        } else {
            return true;
        }
    };

    opendialog = (str, callback) => {
        if (this.browseDialog()) return;
        const { t } = this.props;
        str = str || "";
        this.setState({ disabled: true, isOpenDialog: true });
        dialog
            .showOpenDialog({
                title: t("contract.select {file} path title", { file: str }),
                defaultPath: "/",
                filters: [
                    {
                        name: "*",
                        extensions: [str],
                    },
                ],
            })
            .then(function (res) {
                callback(res);
            })
            .catch(function (error) {
                console.log(error);
            });
    };

    componentDidMount() {
        this.timerID = setInterval(
            () => {
                if (this.state.tableswitch == 1) {
                    this.onEpoch();
                    this.onNodeInfo();
                }
                if (this.state.tableswitch == 6) {
                    this.onGetProcess();
                }
            },
            1000
        );
    }

    componentWillUnmount() {
        clearInterval(this.timerID);
    }

    render = () => {
        const { t } = this.props;
        const accounts = this.props.walletStore.accountlist;
        return (
            <Layout className="gui-container">
                <Sync />
                <Content className="mt3">
                    <Spin tip="Loading..." spinning={this.state.loading}>
                        <Row gutter={[30, 0]} style={{ 'minHeight': 'calc( 100vh - 120px )' }}>
                            <Col span={24} className="bg-white pv4">
                                <PageHeader title={t('translation:advanced.fs.title')}></PageHeader>
                                <div className="pa3">
                                    <br />
                                    <Row>
                                        <Col span={12}>
                                            <SelectItem items={accounts.map(accounts => accounts.address)} placeholder={t("translation:advanced.fs.com-select-account")} func={this.onListContainer.bind(this)} />
                                        </Col>
                                        <Col span={1}>
                                        </Col>
                                        <Col span={11}>
                                            <SelectItem items={this.state.containerIds} placeholder={t("translation:advanced.fs.com-select-cid")} func={this.handelChange.bind(this, "pcontainerId")} />
                                        </Col>
                                    </Row>
                                </div>
                                <div className="pa3">
                                    <Tabs className="fs-title" defaultActiveKey="1" onChange={this.tabParamterClean.bind(this)}>
                                        <TabPane tab={t("translation:advanced.fs.node-title")} key="1">
                                            <Row>
                                                <Col span={24}>
                                                    <Card title={t("translation:advanced.fs.node-epoch")}>
                                                        <p><Statistic value={this.state.epoch} prefix={<RetweetOutlined />} /></p>
                                                    </Card>
                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col span={24}>
                                                    <Card title={t("translation:advanced.fs.node-nodeinfo")} sytle={{ width: "100%" }}>
                                                        <p>{"PublicKey:"}{this.state.nodeinfo.publicKey}</p>
                                                        <p>{"Addresses:"}{JSON.stringify(this.state.nodeinfo.addresses)}</p>
                                                        <p>{"State:"}{this.state.nodeinfo.state}</p>
                                                    </Card>
                                                </Col>
                                            </Row>
                                        </TabPane>
                                        <TabPane tab={t("translation:advanced.fs.account-title")} key="2">
                                            <Row>
                                                <Col span={15}>
                                                    <p size="large">{"Balance:"}{this.state.balance.toString()}{" gas"}</p>
                                                </Col>
                                                <Col span={5}>

                                                </Col>
                                                <Col span={4}>
                                                    <Button size="large" onClick={this.onAccountBalance.bind(this)}>{t("translation:advanced.fs.com-btn-query")}</Button>
                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col span={15}>
                                                    <Input placeholder={t("translation:advanced.fs.account-input-gascount")} value={this.state.pbalance} onChange={this.handelChangeInput.bind(this, "pbalance")} style={{ width: '100%' }} />
                                                </Col>
                                                <Col span={1}>

                                                </Col>
                                                <Col span={4}>
                                                    <Button size="large" onClick={this.onAccountDeposite.bind(this)}>{t("translation:advanced.fs.account-btn-deposit")}</Button>
                                                </Col>
                                                <Col span={4}>
                                                    <Button size="large" onClick={this.onAccountWithdraw.bind(this)}>{t("translation:advanced.fs.account-btn-withdraw")}</Button>
                                                </Col>
                                            </Row>
                                        </TabPane>
                                        <TabPane tab={t("translation:advanced.fs.container-title")} key="3">
                                            <Row>
                                                <Col span={12}>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Input placeholder={t("translation:advanced.fs.com-input-cid")} value={this.state.pcontainerId} onChange={this.handelChangeInput.bind(this, "pcontainerId")} style={{ width: '100%' }} />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={12}>
                                                            <Button size="large" onClick={this.onGetContainer.bind(this)}>{t("translation:advanced.fs.com-btn-query")}</Button>
                                                        </Col>
                                                        <Col span={12}>
                                                            <Button size="large" onClick={this.onDeleteContainer.bind(this)}>{t("translation:advanced.fs.com-btn-delete")}</Button>
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Card size="large" title="Container Info">
                                                                <p prefix={<EditOutlined />} >{this.state.containerinfo.toString()}</p>
                                                            </Card>
                                                        </Col>
                                                    </Row>
                                                </Col>
                                                <Col span={1}>
                                                </Col>
                                                <Col span={11}>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Input placeholder={t("translation:advanced.fs.container-input-policy")} onChange={this.handelChangeInput.bind(this, "ppolicyString")} value={this.state.ppolicyString} style={{ width: '100%' }} size="large" />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Input placeholder={t("translation:advanced.fs.container-input-basicacl")} onChange={this.handelChangeInput.bind(this, "pbasicAcl")} value={this.state.pbasicAcl} style={{ width: '100%' }} size="large" />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Input placeholder={t("translation:advanced.fs.container-input-attributes")} onChange={this.handelChangeInput.bind(this, "pattributesString")} value={this.state.pattributesString} style={{ width: '100%' }} size="large" />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Button size="large" onClick={this.onPutContainer.bind(this)}>{t("translation:advanced.fs.com-btn-create")}</Button>

                                                        </Col>
                                                    </Row>
                                                </Col>
                                            </Row>
                                        </TabPane>
                                        <TabPane tab={t("translation:advanced.fs.eacl-title")} key="4">
                                            <Row>
                                                <Col span={12}>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Search
                                                                placeholder={t("translation:advanced.fs.com-input-cid")}
                                                                enterButton={t("translation:advanced.fs.com-btn-query")}
                                                                size="large"
                                                                value={this.state.pcontainerId}
                                                                onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                                                onSearch={this.onGetContainerEACL.bind(this)}
                                                                style={{ width: '100%' }}
                                                            />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <TextArea rows={12} placeholder={"Container Eacl Info:"} value={this.state.eacl.toString()} prefix={<EditOutlined />} />
                                                        </Col>
                                                    </Row>
                                                </Col>
                                                <Col span={1}></Col>
                                                <Col span={11}>
                                                    <Row>
                                                        <Col span={24}>
                                                            <TextArea rows={12} placeholder={"Please input eacl"} onChange={this.handelChangeInput.bind(this, "peaclString")} prefix={<EditOutlined />} />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <br />
                                                            <Button size="large" onClick={this.onSetContainerEACL.bind(this)}>{t("translation:advanced.fs.eacl-btn-set")}</Button>
                                                        </Col>
                                                    </Row>
                                                </Col>
                                            </Row>
                                        </TabPane>
                                        <TabPane tab={t("translation:advanced.fs.object-title")} key="5">
                                            <Row>
                                                <Col span={12}>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Search
                                                                placeholder={t("translation:advanced.fs.com-input-cid")}
                                                                enterButton={t("translation:advanced.fs.com-btn-oid-query")}
                                                                size="large"
                                                                value={this.state.pcontainerId}
                                                                onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                                                onSearch={this.onListObject.bind(this)}
                                                                style={{ width: '100%' }} />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={12}>
                                                            <SelectItem items={this.state.objectIds} placeholder={t("translation:advanced.fs.com-select-oid")} func={this.OnGetObject.bind(this)} loading={true} />
                                                        </Col>
                                                        <Col span={7}>
                                                            <Button size="large" onClick={this.onDeleteObject.bind(this)}>{t("translation:advanced.fs.com-btn-delete")}</Button>
                                                        </Col>
                                                        <Col span={5}>
                                                            <Switch checkedChildren={t("translation:advanced.fs.object-switch-single")} unCheckedChildren={t("translation:advanced.fs.object-switch-related")} defaultChecked onChange={this.switchChange.bind(this, !this.state.batchDelete)} size="large" />
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <TextArea rows={10} placeholder={"Object Info"} value={this.state.object.toString()}></TextArea>
                                                    </Row>
                                                </Col>
                                                <Col span={1}></Col>
                                                <Col span={11}>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Tabs className="fs-title" defaultActiveKey="1" onChange={this.handelChange.bind(this, "objecttype")}>
                                                                <TabPane tab={t("translation:advanced.fs.object-objecttype-object")} key="1">
                                                                    <TextArea rows={10} placeholder={"Please input object data,data size【1K,2M】"} onChange={this.handelChangeInput.bind(this, "pobjectdata")} value={this.state.pobjectdata} prefix={<EditOutlined />} />
                                                                </TabPane>
                                                                <TabPane tab={t("translation:advanced.fs.object-objecttype-storagegroup")} key="2">
                                                                    <TextArea rows={10} placeholder={t("translation:advanced.fs.object-input-objectId")} onChange={this.handelChangeInput.bind(this, "pobjectIds")} value={this.state.pobjectIds} prefix={<EditOutlined />} />
                                                                </TabPane>
                                                            </Tabs>
                                                        </Col>
                                                    </Row>
                                                    <Row>
                                                        <Col span={24}>
                                                            <Row>
                                                                <Col span={24}>
                                                                    <br />
                                                                    <Button size="large" onClick={this.onPutObject.bind(this)}>{t("translation:advanced.fs.com-btn-create")}</Button>
                                                                </Col>
                                                            </Row>
                                                        </Col>
                                                    </Row>
                                                </Col>
                                            </Row>
                                        </TabPane>
                                        <TabPane tab={t("translation:advanced.fs.bigfile-title")} key="6">
                                            <Row>
                                                <Col span={12}>
                                                    <Search
                                                        placeholder={t("translation:advanced.fs.com-input-cid")}
                                                        enterButton={t("translation:advanced.fs.com-btn-oid-query")}
                                                        size="large"
                                                        value={this.state.pcontainerId}
                                                        onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                                        onSearch={this.onListObject.bind(this)}
                                                        style={{ width: '100%' }} />
                                                </Col>
                                                <Col span={1}></Col>
                                                <Col span={11}>
                                                    <SelectItem items={this.state.objectIds} placeholder={t("translation:advanced.fs.com-select-oid")} func={this.handelChange.bind(this, "pobjectId")} />
                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col span={12}>
                                                    <Input type="txt" placeholder={t("translation:advanced.fs.bigfile-input-uploadloadpath")} value={this.state.uploadpath} onChange={this.handelChangeInput.bind(this, "uploadpath")} style={{ width: "45%" }} /><Button icon={<UploadOutlined />} onClick={this.selectFile.bind(this, 1)} style={{ width: "55%" }}>Select Upload File</Button>
                                                </Col>
                                                <Col span={1}></Col>
                                                <Col span={11}>
                                                    <Input type="txt" placeholder={t("translation:advanced.fs.bigfile-input-downloadpath")} value={this.state.downloadpath} onChange={this.handelChangeInput.bind(this, "downloadpath")} style={{ width: "45%" }} /><Button icon={<DownloadOutlined />} onClick={this.selectFile.bind(this, -1)} style={{ width: "55%" }}>Select DownLoad Seed</Button>
                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col span={11}>
                                                    <Button shape="dashed" size="large" onClick={this.onUploadFile.bind(this, -1, this.state.pcontainerId, this.state.uploadpath, new Date().getTime())} style={{ width: "45%" }}>{t("translation:advanced.fs.bigfile-btn-upload")}</Button>
                                                </Col>
                                                <Col span={2}></Col>
                                                <Col span={11}>
                                                    <Button shape="dashed" size="large" onClick={this.onDownloadFile.bind(this, -1, this.state.pcontainerId, this.state.pobjectId, this.state.downloadpath, new Date().getTime())} style={{ width: "45%" }}>{t("translation:advanced.fs.bigfile-btn-download")}</Button>
                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col span={24}>
                                                    <UploadDownloadTaskList data={this.state.tasks} func1={this.onUploadFile} func2={this.onDownloadFile} style={{ width: "100%" }} />
                                                </Col>
                                            </Row>
                                        </TabPane>
                                    </Tabs>
                                </div>
                            </Col>
                        </Row>
                    </Spin>
                </Content>
                <Modal
                    className="set-modal"
                    title={<Trans>{this.state.title}</Trans>}
                    visible={this.state.visible}
                    onCancel={this.hideModal}
                    footer={null}
                >
                    {this.state.children}
                </Modal>
            </Layout>
        );
    }
}

export default Fs;

const SelectItem = ({ items, placeholder, func }) => {
    return (
        <Select
            placeholder={placeholder}
            defaultActiveFirstOption={true}
            onSelect={func}
            className="multiadd"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
                option.props.children[1].toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            filterSort={(optionA, optionB) =>
                optionA.children[1].toLowerCase().localeCompare(optionB.children[1].toLowerCase())
            }
            size="large"
            style={{ width: '100%' }}
        >
            {items.length > 0 ? items.map((item, index) => {
                return (
                    <Option className="add-list" key={item} value={item}> { item}</Option>
                )
            }) : null}
        </Select>)
}

const UploadDownloadTaskList = ({ data, func1, func2 }) => {
    var _data = data;
    return (<List
        itemLayout="horizontal"
        dataSource={_data}
        renderItem={(item, index) => (
            <List.Item>
                <div style={{ width: '100%' }}>
                    <Row>
                        <Col span={10}>
                            <p>{item.tasktype == 1 ? <UploadOutlined size="large" /> : <DownloadOutlined size="large" />}{"TaskId:" + item.taskId}</p>
                            <p>{"Info:"}</p>
                            <p>{"FileName:" + item.fileName}</p>
                            <p>{"Cid:" + item.containerId}<Copy msg={item.containerId} /></p>
                            <p>{"Oid:" + item.objectId}<Copy msg={item.objectId} /></p>
                            <p>{"TimeStamp:" + item.timeStamp}</p>
                            <p>{"Process:" + item.current + "|" + item.total + "byte"}</p>
                            <p>{"FinishTime:" + item.finish}</p>
                        </Col>
                        <Col span={9}>
                            <a hidden={item.error == null}><Alert type="error" message={"Error " + item.error} banner /></a>
                        </Col>
                        <Col span={1}>
                        </Col>
                        <Col span={4}>
                            <Button size="small" hidden={item.flag != -1} onClick={() => { item.tasktype == 1 ? func1(item.taskId, item.containerId, item.filePath, item.timeStamp) : func2(item.taskId, item.containerId, item.objectId, item.filePath, item.timeStamp) }}>{"Again"}</Button>
                        </Col>
                    </Row>
                    <Progress showInfo percent={(1.0 * item.current / item.total * 100).toFixed(2)} status={item.flag == 0 ? "active" : item.flag == 1 ? "success" : "exception"} style={{ width: '90%' }} />
                </div>
            </List.Item>
        )}
    />)
};

const ModalError = (data, title) => {
    Modal.error({
        width: 600,
        title: title,
        content: (
            <div className="show-pri">
                <p>{data?.error.message} <Copy msg={data?.error.message} /></p>
            </div>
        ),
        okText: <Trans>button.ok</Trans>
    });
};

const ModalSuccess = (data, title) => {
    Modal.success({
        width: 600,
        title: title,
        content: (
            <div className="show-pri">
                <p>{data?.result.toString()} <Copy msg={data?.result.toString()} /></p>
            </div>
        ),
        okText: <Trans>button.ok</Trans>
    });
};
