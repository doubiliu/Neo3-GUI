/* eslint-disable */
import React from 'react';
import 'antd/dist/antd.css';
import axios from 'axios';
import {
    Input,
    Checkbox,
    PageHeader,
    Modal,
    Alert,
    Row,
    Col,
    Form,
    Tabs,
    Button,
    Card,
    Switch,
    Select,
    List,
    Progress,
    Tag,
    message
} from 'antd';
import { Layout } from 'antd';
import { Statistic } from 'antd';
import Sync from '../sync';
import { observer, inject } from "mobx-react";
import { withRouter } from "react-router-dom";
import { withTranslation, Trans } from "react-i18next";
import { WalletOutlined, RetweetOutlined, ForkOutlined, EditOutlined, AudioOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import "../../static/css/advanced.css";
import { Copy } from '../copy';
import { remote } from "electron";
import { size } from 'lodash';

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
            disabled: true,
            visible: false,
            isOpenDialog: false,
            uploadpath: "",
            downloadpath: "",
            show: false,
            switch: false,
            tableswitch:0,
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
            runningtasks: [],
            tasks2: [{ 'tasktype': 0, "taskId": 1, "current": 10, "total": 100, "flag": 0, "error": null, "containerId": "xxxxx", "objectId": "yyyyy", "filePath": "xxxxx" }, { 'tasktype': 0, "taskId": 1, "current": 0, "total": 0, "flag": -1, "error": "xxxxx", "cid": "xxxxx", "oid": "yyyyy", "filePath": "xxxxx" }],
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
                console.log("data:" + _data);
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
                    console.log(_data);
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
        axios.post('http://localhost:8081', {
            "id": "1",
            "method": "OnAccountBalance",
            "params": {
                "paccount": this.state.ppublickey
            }
        })
            .then((response) => {
                var _data = response.data;
                if (_data.msgType === -1) {
                    ModalError(_data, "查询余额失败");
                    return;
                } else if (_data.msgType === 3) {
                    var _data = response.data.result;
                    this.setState({ balance: _data });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onAccountDeposite() {
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
                    ModalError(_data, "质押失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, "质押成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onAccountWithdraw() {
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
                    ModalError(_data, "撤资失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, "撤资成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    //relate container
    onGetContainer() {
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
                    ModalError(_data, "GetContainer失败");
                    return;
                } else if (_data.msgType === 3) {
                    this.setState({ containerinfo: JSON.stringify(response.data.result) });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onListContainer = value => {
        this.state.paccount = value;
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
                    this.setState({ containerIds: [] });
                    ModalError(_data, "ListContainer失败");
                    return;
                } else if (_data.msgType === 3) {
                    console.log(_data.result);
                    this.setState({ containerIds: _data.result });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onPutContainer() {
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
                    ModalError(_data, "PutContainer失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, "PutContainer成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onDeleteContainer() {
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
                    ModalError(_data, "DeleteContainer失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, "DeleteContainer成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    //relate eacl
    onGetContainerEACL() {
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
                console.log("OnGetContainerEACL");
                console.log(_data);
                if (_data.msgType === -1) {
                    ModalError(_data, "GetContainerEACL失败");
                    return;
                } else if (_data.msgType === 3) {
                    var _data = response.data.result;
                    this.setState({ eacl: _data });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onSetContainerEACL() {
        axios.post('http://localhost:8081', {
            "id": "1",
            "method": "OnSetContainerEACL",
            "params": {
                "eaclString": this.state.pcontainerId,
                "eaclString": this.state.peaclString
            }
        })
            .then((response) => {
                var _data = response.data;
                if (_data.msgType === -1) {
                    ModalError(_data, "SetContainerEACL失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, "SetContainerEACL成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    //relate object
    OnGetObject() {
        this.setState({ object: "" }, () => {
            var objectIds = this.state.pobjectIds.split('_');
            for (var i = 0; i < objectIds.length; i++) {
                axios.post('http://localhost:8081', {
                    "id": "1",
                    "method": "OnGetObject",
                    "params": {
                        "containerId": this.state.pcontainerId,
                        "objectId": objectIds[i],
                        "paccount": this.state.paccount
                    }
                })
                    .then((response) => {
                        var _data = response.data;
                        if (_data.msgType === -1) {
                            ModalError(_data, "GetObject失败");
                            return;
                        } else if (_data.msgType === 3) {
                            var result = this.state.object;
                            result += response.data.result.toString();
                            this.setState({ object: result });
                            return;
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                    });
            }
        });
    }

    onListObject() {
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
                    ModalError(_data, "ListObject失败");
                    return;
                } else if (_data.msgType === 3) {
                    console.log(_data.result);
                    this.setState({ objectIds: _data.result });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onPutObject() {
        var flag = this.state.switch;
        axios.post('http://localhost:8081', flag ? {
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
                    ModalError(_data, flag ? "PutObject失败" : "StorageGroupObject失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, flag ? "PutObject成功" : "StorageGroupObject成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onDeleteObject() {
        axios.post('http://localhost:8081', {
            "id": "1",
            "method": "OnDeleteObject",
            "params": {
                "containerId": this.state.pcontainerId,
                "pobjectIds": this.state.pobjectIds,
                "paccount": this.state.paccount
            }
        })
            .then((response) => {
                var _data = response.data;
                if (_data.msgType === -1) {
                    ModalError(_data, "DeleteObject失败");
                    return;
                } else if (_data.msgType === 3) {
                    ModalSuccess(_data, "DeleteObject成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    //relate file
    onUploadFile = (taskId, timestamp) => {
        axios.post('http://localhost:8081', {
            "id": 1,
            "method": "OnUploadFile",
            "params": {
                "taskId": taskId,
                "containerId": this.state.pcontainerId,
                "filePath": this.state.uploadpath,
                "paccount": this.state.paccount,
                "timestamp": timestamp,
            }
        })
            .then((response) => {
                var _data = response.data;
                console.log(_data);
                if (_data.msgType === -1) {
                    ModalError(_data, "UploadFile任务创建失败");
                    return;
                } else if (_data.msgType === 3) {
                    if (taskId < 0) return;
                    var tasks = this.state.runningtasks.slice();
                    tasks.push(_data.result.taskId);
                    this.setState({ runningtasks: tasks });
                    ModalSuccess(_data, "UploadFile任务创建成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    onDownloadFile = (taskId, timestamp) => {
        axios.post('http://localhost:8081', {
            "id": 1,
            "method": "OnDownloadFile",
            "params": {
                "taskId": taskId,
                "containerId": this.state.pcontainerId,
                "objectId": this.state.pobjectId,
                "filePath": this.state.downloadpath,
                "paccount": this.state.paccount,
                "timestamp": timestamp,
            }
        })
            .then((response) => {
                var _data = response.data;
                console.log(_data);
                if (_data.msgType === -1) {
                    ModalError(_data, "DownloadFile任务创建失败");
                    return;
                } else if (_data.msgType === 3) {
                    if (taskId < 0) return;
                    var tasks = this.state.runningtasks.slice();
                    tasks.push(_data.result.taskId);
                    this.setState({ runningtasks: tasks });
                    ModalSuccess(_data, "DownloadFile任务创建成功");
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }


    onGetProcess = () => {
        axios.post('http://localhost:8081', {
            "method": "OnGetProcess",
            "params": {
            }
        })
            .then((response) => {
                var _data = response.data;
                console.log(_data);
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
                    return;
                } else if (_data.msgType === 3) {
                    var temp=_data.result.split("_");
                    this.setState({
                        pcontainerId: temp[0],
                        objectIds: [temp[1]]
                    });
                    return;
                }
            })
            .catch(function (error) {
                console.log(error);
            });
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

    tabParamterClean = (key, event) => {
        this.setState({
            ppublickey: "",
            pbalance: 0,
            pcontainerId: "",
            ppolicyString: "",
            pbasicAcl: "",
            pattributesString: "",
            peaclString: "",
            pobjectId: "",
            pobjectIds: "",
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
            objectIds: []
        })
    }

    switchChange = (checked) => {
        this.setState({
            switch: checked
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
                    this.onGetSeedFile(res.filePaths[0])
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
                    <Row gutter={[30, 0]} style={{ 'minHeight': 'calc( 100vh - 120px )' }}>
                        <Col span={24} className="bg-white pv4">
                            <PageHeader title={t('分布式文件存储服务')}></PageHeader>
                            <div className="pa3">
                                <br />
                                <Row>
                                    <Col span={12}>
                                        <SelectAccount accounts={accounts} func={this.onListContainer.bind(this)} />
                                    </Col>
                                    <Col span={1}>
                                    </Col>
                                    <Col span={11}>
                                        <SelectItem items={this.state.containerIds} placeholder={"请选择账户持有的containerId"} func={this.handelChange.bind(this, "pcontainerId")} />
                                    </Col>
                                </Row>
                            </div>
                            <div className="pa3">
                                <Tabs className="fs-title" defaultActiveKey="1" onChange={this.handelChange.bind(this,"tableswitch")}>
                                    <TabPane tab={t("节点信息")} key="1">
                                        <Row>
                                            <Col span={24}>
                                                <Card title="当前Epoch">
                                                <p><Statistic value={this.state.epoch} prefix={<RetweetOutlined />} /></p>
                                                </Card>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={24}>
                                                <Card title="节点状态" sytle={{ width: "100%" }}>
                                                    <p>{"PublicKey:"}{this.state.nodeinfo.publicKey}</p>
                                                    <p>{"Addresses:"}{JSON.stringify(this.state.nodeinfo.addresses)}</p>
                                                    <p>{"State:"}{this.state.nodeinfo.state}</p>
                                                </Card>
                                            </Col>
                                        </Row>
                                    </TabPane>
                                    <TabPane tab={t("账户相关")} key="2">
                                        <Search
                                            placeholder="请输入公钥"
                                            enterButton="Search"
                                            size="large"
                                            value={this.state.ppublickey}
                                            onChange={this.handelChangeInput.bind(this, "ppublickey")}
                                            onSearch={this.onAccountBalance.bind(this)}
                                            style={{ width: '50%' }}
                                        />
                                        <br />
                                        <Statistic title="账户余额" value={this.state.balance.toString() + " gas"} prefix={<RetweetOutlined />} />
                                        <br />
                                        <Search
                                            placeholder="请输入gas数量"
                                            enterButton="质押"
                                            size="large"
                                            value={this.state.pbalance}
                                            onChange={this.handelChangeInput.bind(this, "pbalance")}
                                            onSearch={this.onAccountDeposite.bind(this)}
                                            style={{ width: '50%' }}
                                        />
                                        <Button size="large" onClick={this.onAccountWithdraw.bind(this)}>撤资</Button>
                                    </TabPane>
                                    <TabPane tab={t("容器相关")} key="3">
                                        <Row>
                                            <Col span={12}>
                                                <Search
                                                    placeholder="请输入containerId"
                                                    enterButton="Search"
                                                    size="large"
                                                    value={this.state.pcontainerId}
                                                    onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                                    onSearch={this.onGetContainer.bind(this)}
                                                />
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <Button size="large" onClick={this.onPutContainer.bind(this)}>创建</Button>{" "}
                                                <Button size="large" onClick={this.onDeleteContainer.bind(this)}>删除</Button>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Card size="large" title="Container Info">
                                                    <p prefix={<EditOutlined />} >{this.state.containerinfo.toString()}</p>
                                                </Card>
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <Row>
                                                    <Input placeholder={"请输入Policy"} onChange={this.handelChangeInput.bind(this, "ppolicyString")} style={{ width: '100%' }} />
                                                </Row>
                                                <br />
                                                <Row>
                                                    <Input placeholder={"请输入BasicAcl"} onChange={this.handelChangeInput.bind(this, "pbasicAcl")} style={{ width: '100%' }} />
                                                </Row>
                                                <br />
                                                <Row>
                                                    <Input placeholder={"请输入Attributes"} onChange={this.handelChangeInput.bind(this, "pattributesString")} style={{ width: '100%' }} />
                                                </Row>
                                                <br />
                                            </Col>
                                        </Row>
                                    </TabPane>
                                    <TabPane tab={t("EACL权限相关")} key="4">
                                        <Search
                                            placeholder="请输入containerId"
                                            enterButton="Search"
                                            size="large"
                                            value={this.state.pcontainerId}
                                            onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                            onSearch={this.onGetContainerEACL.bind(this)}
                                            style={{ width: '50%' }}
                                        />
                                        <Button size="large" onClick={this.onSetContainerEACL.bind(this)}>设置</Button>
                                        <br />
                                        <br />
                                        <TextArea rows={4} placeholder={"container eacl info"} value={this.state.eacl.toString()} onChange={this.handelChangeInput.bind(this, "peacl")} prefix={<EditOutlined />} />
                                    </TabPane>
                                    <TabPane tab={t("对象相关")} key="5">
                                        <Row>
                                            <Col span={12}>
                                                <Search
                                                    placeholder="请输入containerId"
                                                    enterButton="获取objectId"
                                                    size="large"
                                                    value={this.state.pcontainerId}
                                                    onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                                    onSearch={this.onListObject.bind(this)}
                                                    style={{ width: '100%' }} />
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <SelectItem items={this.state.objectIds} placeholder={"请选择objecctId"} func={this.handelChange.bind(this, "pobjectIds")} />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <TextArea rows={4} placeholder={"请输入object data,data 大小【1M,2M】"} onChange={this.handelChangeInput.bind(this, "pobjectdata")} prefix={<EditOutlined />} />
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <Row>
                                                    <Col span={7}><Button size="large" onClick={this.onPutObject.bind(this)}>创建</Button></Col>
                                                    <Col span={7}><Button size="large" onClick={this.onDeleteObject.bind(this)}>删除</Button></Col>
                                                    <Col span={7}><p>{"StorageGroup"}<Switch defaultChecked onChange={this.switchChange.bind(this, !this.state.switch)} /></p></Col>
                                                </Row>
                                            </Col>
                                        </Row>
                                        <br />
                                        <Row>
                                            <Col span={12}>
                                                <TextArea rows={4} placeholder={ "Object Info"} value={this.state.object.toString()}></TextArea>
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <Search
                                                    placeholder="请输入objectId,允许多个用 _ 分割"
                                                    enterButton="获取object"
                                                    size="large"
                                                    value={this.state.pobjectIds}
                                                    onChange={this.handelChangeInput.bind(this, "pobjectIds")}
                                                    onSearch={this.OnGetObject.bind(this)}
                                                    style={{ width: '100%' }}
                                                />
                                            </Col>
                                        </Row>
                                    </TabPane>
                                    <TabPane tab={t("文件传输相关")} key="6">
                                        <Row>
                                            <Col span={12}>
                                                <Search
                                                    placeholder="请输入containerId"
                                                    enterButton="获取objectId"
                                                    size="large"
                                                    value={this.state.pcontainerId}
                                                    onChange={this.handelChangeInput.bind(this, "pcontainerId")}
                                                    onSearch={this.onListObject.bind(this)}
                                                    style={{ width: '100%' }} />
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <SelectItem items={this.state.objectIds} placeholder={"请选择objecctId"} func={this.handelChange.bind(this, "pobjectId")} />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <Input type="txt" placeholder={"请输入上传文件路径"} value={this.state.uploadpath} style={{ width: "45%" }} /><Button icon={<UploadOutlined />} onClick={this.selectFile.bind(this, 1)} style={{ width: "55%" }}>Select Upload File</Button>
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={11}>
                                                <Input type="txt" placeholder={"请输入种子文件路径"} value={this.state.downloadpath} style={{ width: "45%" }} /><Button icon={<DownloadOutlined />} onClick={this.selectFile.bind(this, -1)} style={{ width: "55%" }}>Select DownLoad Path</Button>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={17}>
                                                <UploadDownloadTaskList data={this.state.tasks} func={this.onUploadFile} style={{ width: "100%" }} />
                                            </Col>
                                            <Col span={1}></Col>
                                            <Col span={6}>
                                                <Button shape="dashed" size="large" onClick={this.onUploadFile.bind(this, -1, new Date().getTime())} style={{ width: "50%" }}>上传</Button>
                                                <Button shape="dashed" size="large" onClick={this.onDownloadFile.bind(this, -1, new Date().getTime())} style={{ width: "50%" }}>下载</Button>
                                            </Col>
                                        </Row>
                                    </TabPane>
                                </Tabs>
                            </div>
                        </Col>
                    </Row>
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
            onSelect={func}
            className="multiadd"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            filterSort={(optionA, optionB) =>
                optionA.children.toLowerCase().localeCompare(optionB.children.toLowerCase())
            }
            size="large"
            style={{ width: '100%' }}
        >
            {items.length > 0 ? items.map((item,index) => {
                return (
                    <Option className="add-list" key={item} value={item}> { item}</Option>
                )
            }) : null}
        </Select>)
}

const SelectAccount = ({ accounts, func }) => {
    return (
        <Select
            placeholder="请选择账户"
            onSelect={func}
            size="large"
            className="multiadd"
            style={{ width: '100%' }}>
            {accounts.length > 0 ? accounts.map((item) => {
                return (
                    <Option className="add-list" key={item.address} value={item.address}>{item.address}</Option>
                )
            }) : null}
        </Select>)
}
//tasks: [{ 'tasktype': 0, "taskId": 1, "current": 0, "total": 0, "flag": -1 ,"error":"xxxxx", "containerId":xxxxxx,"objectId":"yyyyy","filePath":"xxxxx"}],
//<Progress percent={1.0 * item.current / item.total * 100} status="active" />
const UploadDownloadTaskList = (data, func1, func2) => {
    var _data = data.data;
    //console.log(_data);
    return (<List
        itemLayout="horizontal"
        dataSource={_data}
        renderItem={(item, index) => (
            <List.Item>
                <div style={{ width: '100%' }}>
                    <Row>
                        <Col span={10}>
                            <p>{item.tasktype == 1 ? <UploadOutlined size="large" /> : <DownloadOutlined size="large" />}{"TaskId:" + item.taskId}</p>
                            <p>{"信息:"}</p>
                            <p>{"文件名称:" + item.fileName}</p>
                            <p>{"cid:" + item.containerId}<Copy msg={item.containerId} /></p>
                            <p>{"oid:" + item.objectId}<Copy msg={item.objectId} /></p>
                            <p>{"timestamp:" + item.timeStamp}</p>
                            <p>{"完成度:" + item.current + "|" + item.total + "byte"}</p>
                            <p>{"完成时间:" + item.finish}</p>
                        </Col>
                        <Col span={9}>
                            <a hidden={item.error == null}><Alert type="error" message={"Error " + item.error} banner /></a>
                        </Col>
                        <Col span={1}>
                        </Col>
                        <Col span={4}>
                            <Button size="small" hidden={item.flag != -1} onClick={() => { item.tasktype == 1 ? func1(item.taskId, item.timeStamp) : func2(item.taskId, item.timeStamp) }}>{"重试"}</Button>
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
                <p>{data.error.message} <Copy msg={data.error.message} /></p>
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
                <p>{data.result.toString()} <Copy msg={data.result.toString()} /></p>
            </div>
        ),
        okText: <Trans>button.ok</Trans>
    });
};
