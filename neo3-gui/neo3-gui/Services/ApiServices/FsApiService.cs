using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Google.Protobuf;
using Neo.Common.Consoles;
using Neo.Cryptography;
using Neo.FileStorage.API.Client;
using Neo.FileStorage.API.Container;
using Neo.FileStorage.API.Cryptography;
using Neo.FileStorage.API.Cryptography.Tz;
using Neo.FileStorage.API.Netmap;
using Neo.FileStorage.API.Object;
using Neo.FileStorage.API.Refs;
using Neo.FileStorage.API.Session;
using Neo.FileStorage.API.StorageGroup;
using Neo.Models;
using Neo.Network.P2P.Payloads;
using Neo.Persistence;
using Neo.SmartContract;
using Neo.SmartContract.Native;
using Neo.VM;
using Neo.Wallets;
using ByteString = Google.Protobuf.ByteString;
using static Neo.FileStorage.API.Policy.Helper;
using Neo.FileStorage.API.Acl;
using System.Numerics;
using Neo.IO.Json;
using System.Collections.Concurrent;
using System.Diagnostics;

namespace Neo.Services.ApiServices
{
    public class FsApiService : ApiService
    {
        private static UInt160 FsContractHash => CliSettings.Default.Fs.FsContractHash;
        private static string Host => CliSettings.Default.Fs.Host;
        private static string DownLoadPath => CliSettings.Default.Fs.DownloadPath;
        private static string UpLoadPath => CliSettings.Default.Fs.UploadPath;
        private static ConcurrentDictionary<int, Process> TaskList = new ConcurrentDictionary<int, Process>();
        private static int TaskIndex;


        //relate account
        public async Task<object> OnAccountBalance(string paccount)
        {
            Console.WriteLine($"paccount:{paccount}");
            if (NoWallet()) return Error(ErrorCode.WalletNotOpen);
            var account = CurrentWallet.GetAccounts().Where(p => !p.WatchOnly).ToArray()[0].ScriptHash;
            var key = CurrentWallet.GetAccount(account).GetKey().Export().LoadWif();
            Cryptography.ECC.ECPoint pk = ParseEcpoint(paccount, out var err);
            if (err is not null) return err;
            var ownerID = OwnerID.FromScriptHash(Contract.CreateSignatureRedeemScript(pk).ToScriptHash());
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            if (OnGetBalanceInternal(client, key, ownerID,out FileStorage.API.Accounting.Decimal result))
            {
                Console.WriteLine($"Fs current account :{Contract.CreateSignatureRedeemScript(pk).ToScriptHash()}, balance:{(result.Value == 0 ? 0 : result)}");
                return new Neo.BigDecimal(new BigInteger(result.Value), NativeContract.GAS.Decimals);
            }
            return Error(ErrorCode.GetBalanceFault);
        }

        public async Task<object> OnAccountWithdraw(string pamount, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out UInt160 account, out ECDsa key);
            if (err is not null) return err;
            var amount = int.Parse(pamount);
            if (amount <= 0)
            {
                Console.WriteLine("Amount cannot be negative");
                return Error(ErrorCode.InvalidPara);
            }
            DataCache snapshot = Helpers.GetDefaultSnapshot();
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            if (!OnGetBalanceInternal(client, key, null,out FileStorage.API.Accounting.Decimal balance)) return Error(ErrorCode.GetBalanceFault); ;
            if (balance.Value < amount * NativeContract.GAS.Decimals)
            {
                Console.WriteLine($"Fs current account balance is not enough");
                return Error(ErrorCode.GasNotEnough);
            }
            byte[] script = FsContractHash.MakeScript("withdraw", account, amount);
            Transaction tx = new Transaction
            {
                Version = 0,
                Nonce = (uint)new Random().Next(),
                Script = script,
                ValidUntilBlock = NativeContract.Ledger.CurrentIndex(snapshot) + CliSettings.Default.Protocol.MaxValidUntilBlockIncrement,
                Signers = new Signer[] { new Signer() { Account = account, Scopes = WitnessScope.Global } },
                Attributes = Array.Empty<TransactionAttribute>(),
            };
            var data = new ContractParametersContext(snapshot, tx, CliSettings.Default.Protocol.Network);
            CurrentWallet.Sign(data);
            tx.Witnesses = data.GetWitnesses();
            ApplicationEngine engine = ApplicationEngine.Run(script, snapshot, tx, null, CliSettings.Default.Protocol);
            if (engine.State != VMState.HALT)
            {
                Console.WriteLine($"Execution of Withdraw request failed,error:{engine.FaultException}");
                return Error(ErrorCode.EngineFault);
            }
            tx.SystemFee = engine.GasConsumed;
            tx.NetworkFee = CurrentWallet.CalculateNetworkFee(snapshot, tx);
            if (NativeContract.GAS.BalanceOf(snapshot, account) < engine.GasConsumed + tx.NetworkFee)
            {
                Console.WriteLine("Gas insufficient");
                return Error(ErrorCode.GasNotEnough);
            }
            data = new ContractParametersContext(snapshot, tx, CliSettings.Default.Protocol.Network);
            CurrentWallet.Sign(data);
            tx.Witnesses = data.GetWitnesses();
            await tx.Broadcast();
            Console.WriteLine($"The withdraw request has been submitted, please confirm in the next block,TxID:{tx.Hash}");
            return tx.Hash.ToString();
        }

        public async Task<object> OnAccountDeposite(string pamount, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out UInt160 account, out _);
            if (err is not null) return err;
            DataCache snapshot = Helpers.GetDefaultSnapshot();
            AssetDescriptor descriptor = new AssetDescriptor(snapshot, CliSettings.Default.Protocol, NativeContract.GAS.Hash);
            if (!BigDecimal.TryParse(pamount, descriptor.Decimals, out BigDecimal decimalAmount) || decimalAmount.Sign <= 0)
            {
                Console.WriteLine("Incorrect Amount Format");
                return Error(ErrorCode.InvalidPara);
            }

            if (NativeContract.GAS.BalanceOf(snapshot, account) < decimalAmount.Value)
            {
                Console.WriteLine("Gas insufficient");
                return Error(ErrorCode.GasNotEnough);
            }
            byte[] script = NativeContract.GAS.Hash.MakeScript("transfer", account, FsContractHash, decimalAmount.Value, Array.Empty<byte>());
            Transaction tx = new Transaction
            {
                Version = 0,
                Nonce = (uint)new Random().Next(),
                Script = script,
                ValidUntilBlock = NativeContract.Ledger.CurrentIndex(snapshot) + CliSettings.Default.Protocol.MaxValidUntilBlockIncrement,
                Signers = new Signer[] { new Signer() { Account = account, Scopes = WitnessScope.Global } },
                Attributes = Array.Empty<TransactionAttribute>(),
            };
            var data = new ContractParametersContext(snapshot, tx, CliSettings.Default.Protocol.Network);
            CurrentWallet.Sign(data);
            tx.Witnesses = data.GetWitnesses();
            ApplicationEngine engine = ApplicationEngine.Run(script, snapshot, tx, null, CliSettings.Default.Protocol);
            if (engine.State != VMState.HALT)
            {
                Console.WriteLine($"Execution of Withdraw request failed,error:{engine.FaultException}");
            }
            tx.SystemFee = engine.GasConsumed;
            tx.NetworkFee = CurrentWallet.CalculateNetworkFee(snapshot, tx);
            if (NativeContract.GAS.BalanceOf(snapshot, account) < engine.GasConsumed + tx.NetworkFee)
            {
                Console.WriteLine("Gas insufficient");
                return Error(ErrorCode.GasNotEnough);
            }
            data = new ContractParametersContext(snapshot, tx, CliSettings.Default.Protocol.Network);
            CurrentWallet.Sign(data);
            tx.Witnesses = data.GetWitnesses();
            await tx.Broadcast();
            Console.WriteLine($"The deposite request has been submitted, please confirm in the next block,TxID:{tx.Hash}");
            return tx.Hash.ToString();
        }

        //relate netmap
        public async Task<object> OnGetEpoch()
        {
            var err = CheckAndParseAccount(null, out _, out ECDsa key);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            if (OnGetEpochInternal(client, out ulong epoch))
            {
                Console.WriteLine($"Fs current epoch:{epoch}");
                return epoch;
            }
            return Error(ErrorCode.GetEpochFault);
        }

        public async Task<object> OnGetLocalNodeInfo()
        {
            var err = CheckAndParseAccount(null, out _, out ECDsa key);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            var source = new CancellationTokenSource();
            source.CancelAfter(10000);
            try
            {
                NodeInfo nodeInfo = client.LocalNodeInfo(context: source.Token).Result;
                source.Cancel();
                Console.WriteLine($"Fs local node info:{nodeInfo}");
                return nodeInfo.ToJson();
            }
            catch (Exception e)
            {
                Console.WriteLine($"Fs get localnode info fault,error:{e}");
                source.Cancel();
                return Error(ErrorCode.GetLocalNodeFault);
            }
        }

        //relate container
        public async Task<object> OnPutContainer(string policyString, string basicAcl, string attributesString, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            var policy = ParsePlacementPolicy(policyString);
            var container = new Container
            {
                Version = FileStorage.API.Refs.Version.SDKVersion(),
                OwnerId = OwnerID.FromScriptHash(key.PublicKey().PublicKeyToScriptHash()),
                Nonce = Guid.NewGuid().ToByteString(),
                BasicAcl = uint.Parse(basicAcl),
                PlacementPolicy = policy,
            };
            Container.Types.Attribute[] attributes = attributesString.Split("_").Select(p => new Container.Types.Attribute() { Key = p.Split("-")[0], Value = p.Split("-")[1] }).ToArray();
            container.Attributes.Add(attributes);
            var source = new CancellationTokenSource();
            source.CancelAfter(10000);
            try
            {
                var cid = client.PutContainer(container, context: source.Token).Result;
                source.Cancel();
                Console.WriteLine($"The container put request has been submitted, please confirm in the next block,ContainerId:{cid.ToString()}");
                return cid.String();
            }
            catch (Exception e)
            {
                Console.WriteLine($"The container put fault, error:{e}");
                source.Cancel();
                return Error(ErrorCode.PutContainerFault);
            }
        }

        public async Task<object> OnDeleteContainer(string containerId, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            using var source = new CancellationTokenSource();
            source.CancelAfter(10000);
            try
            {
                client.DeleteContainer(cid, context: source.Token).Wait();
                source.Cancel();
                Console.WriteLine($"The container delete request has been submitted, please confirm in the next block,ContainerId:{containerId}");
                return true;
            }
            catch (Exception e)
            {
                Console.WriteLine($"The container delete fault,error:{e}");
                source.Cancel();
                return false;
            }

        }

        public async Task<object> OnGetContainer(string containerId, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            using var source = new CancellationTokenSource();
            try
            {
                var container = client.GetContainer(cid, context: source.Token).Result;
                source.Cancel();
                Console.WriteLine($"Container info:{container.Container.ToJson()}");
                return container.Container.ToString();
            }
            catch (Exception e)
            {
                source.Cancel();
                Console.WriteLine($"Get container fault,error:{e}");
                return Error(ErrorCode.GetContainerFault);
            }
        }

        public async Task<object> OnListContainer(string paccount)
        {
            var err = CheckAndParseAccount(paccount, out UInt160 account, out ECDsa key);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            using var source = new CancellationTokenSource();
            OwnerID ownerID = OwnerID.FromScriptHash(key.PublicKey().PublicKeyToScriptHash());
            try
            {
                List<ContainerID> containerLists = client.ListContainers(ownerID, context: source.Token).Result;
                source.Cancel();
                Console.WriteLine($"Container list:");
                containerLists.ForEach(p => Console.WriteLine($"ContainerID:{p.ToString()}"));
                return containerLists.Select(p => p.String()).ToList();
            }
            catch (Exception e)
            {
                source.Cancel();
                Console.WriteLine($"Get fs container list fault,error:{e}");
                return Error(ErrorCode.GetContainerListFault);
            }
        }

        //relate eacl
        public async Task<object> OnGetContainerEACL(string containerId, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            try
            {
                var eAcl = client.GetEAcl(cid, context: source.Token).Result;
                source.Cancel();
                Console.WriteLine($"Container eacl info: cid:{containerId},eacl:{eAcl.Table}");
                return eAcl.Table;
            }
            catch (Exception e)
            {
                source.Cancel();
                Console.WriteLine($"Get container eacl fault,error:{e}");
                return Error(ErrorCode.GetContainerEaclFault);
            }
        }

        public async Task<object> OnSetContainerEACL(string eaclString, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            EACLTable table = EACLTable.Parser.ParseJson(eaclString);
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            try
            {
                client.SetEACL(table, context: source.Token).Wait();
                source.Cancel();
                Console.WriteLine($"The eacl set request has been submitted,please confirm in the next block");
                return true;
            }
            catch (Exception e)
            {
                source.Cancel();
                Console.WriteLine($"The eacl set fault,error:{e}");
                return false;
            }
        }

        //relate object
        public async Task<object> OnPutObject(string containerId, string pdata, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            if (pdata.Length > 2048 || pdata.Length < 1024)
            {
                Console.WriteLine("The data length out of range");
                return Error(ErrorCode.InvalidPara);
            }
            var data = UTF8Encoding.UTF8.GetBytes(pdata);
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            var obj = OnCreateObjectInternal(cid, key, data, ObjectType.Regular);
            if (OnPutObjectInternal(client, obj))
            {
                Console.WriteLine($"The object put successfully, ObjectID:{obj.ObjectId.String()}");
                return obj.ObjectId.String();
            }
            return Error(ErrorCode.PutContainerFault);
        }

        public async Task<object> OnDeleteObject(string containerId, string pobjectIds, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            SessionToken session = OnCreateSessionInternal(client);
            if (session is null) return Error(ErrorCode.CreateSessionFault);
            string[] objectIds = pobjectIds.Split("_");
            foreach (var objectId in objectIds)
            {
                var oid = ObjectID.FromString(objectId);
                Address address = new Address(cid, oid);
                using var source = new CancellationTokenSource();
                source.CancelAfter(TimeSpan.FromMinutes(1));
                try
                {
                    var objId = client.DeleteObject(address, new CallOptions { Ttl = 2, Session = session }, source.Token).Result;
                    source.Cancel();
                    Console.WriteLine($"The object delete successfully,ObjectID:{objId}");
                }
                catch (Exception e)
                {
                    source.Cancel();
                    Console.WriteLine($"The object delete fault,error:{e}");
                    throw e;
                }
            }
            return true;
        }

        public async Task<object> OnGetObject(string containerId, string objectId, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            Console.WriteLine($"result:{paccount}");
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            Console.WriteLine($"result:{containerId}");
            ObjectID oid = ParseObjectID(objectId, out err);
            if (err is not null) return err;
            Console.WriteLine($"result:{objectId}");
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            var obj = OnGetObjectInternal(client, cid, oid);
            if (obj is null) return Error(ErrorCode.GetObjectFault);
            Console.WriteLine($"Object info:{obj.ToJson()}");
            return obj.ToJson().ToString();
        }

        public async Task<object> OnListObject(string containerId, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out _, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out var error);
            if (error is not null) return error;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            var filter = new SearchFilters();
            try
            {
                List<ObjectID> objs = client.SearchObject(cid, filter, context: source.Token).Result;
                source.Cancel();
                Console.WriteLine($"list object,cid:{cid}");
                objs.ForEach(p => Console.WriteLine($"ObjectId:{p.ToString()}"));
                return objs.Select(p => p.String()).ToList();
            }
            catch (Exception e)
            {
                Console.WriteLine($"fs get object list fault,error:{e}");
                source.Cancel();
                return Error(ErrorCode.GetContainerListFault);
            }
        }

        public async Task<object> OnStorageGroupObject(string containerId, string pobjectIds, string paccount = null)
        {
            var err = CheckAndParseAccount(paccount, out UInt160 account, out ECDsa key);
            if (err is not null) return err;
            string[] objectIds = pobjectIds.Split("_");
            ContainerID cid = ParseContainerID(containerId, out var error);
            if (error is not null) return error;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            SessionToken session = OnCreateSessionInternal(client);
            if (session is null) return Error(ErrorCode.CreateSessionFault);
            List<ObjectID> oids = objectIds.Select(p => ObjectID.FromString(p)).ToList();
            var obj = OnCreateStorageGroupObjectInternal(client, key, cid, oids.ToArray());
            if (OnPutObjectInternal(client, obj, session))
            {
                Console.WriteLine($"The storagegroup object put successfully,ObjectID:{obj.ObjectId.ToString()}");
                return obj.ObjectId.String();
            }
            return Error(ErrorCode.PutStorageGroupObjectFault);
        }

        ////relate file upload/download
        public async Task<object> OnUploadFile(int taskId, string containerId, string filePath, string timestamp, string paccount = null)
        {
            if (TaskList.Count >= 5) return Error(ErrorCode.TooMuchTask);
            var err = CheckAndParseAccount(paccount, out UInt160 account, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out var error);
            if (error is not null) return error;
            FileInfo fileInfo = new FileInfo(filePath);
            var FileLength = fileInfo.Length;
            //data segmentation
            long PackCount = 0;
            int PackSize = 2 * 1024 * 1000;
            if (FileLength % PackSize > 0)
                PackCount = (int)(FileLength / PackSize) + 1;
            else
                PackCount = (int)(FileLength / PackSize);
            Process uploadProcess = null;
            if (taskId < 0)
            {
                taskId = Interlocked.Increment(ref TaskIndex);
                uploadProcess = new Process(taskId, 1, containerId, null, fileInfo.Name, filePath, (ulong)FileLength, timestamp, PackCount);
                TaskList.TryAdd(taskId, uploadProcess);
            }
            else
            {
                uploadProcess = TaskList[taskId];
                uploadProcess.Rest();
            }
            var task = new Task(() =>
            {
                var err = OnUploadFileInternal(uploadProcess.TaskId, cid, filePath, key, PackCount, PackSize, FileLength, fileInfo.Name, timestamp);
                if (err is not null)
                {
                    uploadProcess.Fault(err);
                }
            });
            task.Start();
            return uploadProcess.ToJson();
        }

        public async Task<object> OnDownloadFile(int taskId, string containerId, string objectId, string filePath, string paccount = null)
        {
            if (TaskList.Count >= 5) return Error(ErrorCode.TooMuchTask);
            var err = CheckAndParseAccount(paccount, out UInt160 account, out ECDsa key);
            if (err is not null) return err;
            ContainerID cid = ParseContainerID(containerId, out err);
            if (err is not null) return err;
            ObjectID oid = ParseObjectID(objectId, out err);
            if (err is not null) return err;

            var subObjectIDs = new List<ObjectID>();
            //download storagegroup object
            var totalDataSize = 0ul;
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            var obj = OnGetObjectInternal(client, cid, oid);
            if (obj is null || obj.ObjectType != ObjectType.StorageGroup)
            {
                Console.WriteLine("Missing file index, please provide the correct objectid");
                return Error(ErrorCode.GetObjectFault);
            }
            var sg = StorageGroup.Parser.ParseFrom(obj.Payload.ToByteArray());
            totalDataSize = sg.ValidationDataSize;
            //DownLoadProcess.Init(totalDataSize);
            Console.WriteLine($"Download file index successfully");
            Console.WriteLine($"File objects size: {totalDataSize}");
            Console.WriteLine($"File subobject list:");
            foreach (var m in sg.Members)
            {
                subObjectIDs.Add(m);
                Console.WriteLine($"subobjectId:{m.ToString()}");
            }
            string FileName = null;
            string Timestamp = null;
            obj.Attributes.ForEach(p =>
            {
                if (p.Key == FileStorage.API.Object.Header.Types.Attribute.AttributeFileName) FileName = p.Value;
                if (p.Key == FileStorage.API.Object.Header.Types.Attribute.AttributeTimestamp) Timestamp = p.Value;
            });
            Process downloadProcess = null;
            if (taskId < 0)
            {
                taskId = Interlocked.Increment(ref TaskIndex);
                downloadProcess = new Process(taskId, 0, containerId, objectId, FileName, filePath, totalDataSize, Timestamp, subObjectIDs.Count);
                downloadProcess.SubObjectIds = subObjectIDs.ToArray();
                TaskList.TryAdd(taskId, downloadProcess);
            }
            else
            {
                downloadProcess = TaskList[taskId];
                downloadProcess.Rest();
            }
            var task = new Task(() =>
            {
                var err = OnDownloadFileInternal(downloadProcess.TaskId, cid, filePath, (long)totalDataSize, key);
                if (err is not null)
                {
                    downloadProcess.Fault(err);
                }
            });
            task.Start();
            return downloadProcess.ToJson();
        }

        public async Task<object> OnGetProcess()
        {
            return TaskList.Select(p => p.Value.ToJson()).ToArray();
        }

        public async Task<object> OnGetFile(string filePath)
        {
            FileInfo file = new FileInfo(filePath);
            if (!file.Exists) return Error(ErrorCode.FileNotExist);
            return  UTF8Encoding.UTF8.GetString(OnGetFileInternal(filePath, 0, (int)file.Length, file.Length));
        }

        private WsError OnUploadFileInternal(int taskId, ContainerID cid, string filePath, ECDsa key, long PackCount, int PackSize, long FileLength, string fileName, string timeStamp)
        {
            Stopwatch stopWatch = new Stopwatch();
            stopWatch.Start();
            using var client = OnCreateClientInternal(key);
            if (client is null) return Error(ErrorCode.CreateClientFault);
            var session = OnCreateSessionInternal(client);
            if (session is null) return Error(ErrorCode.CreateSessionFault);
            //upload subobjects
            var uploadProcess = TaskList[taskId];
            var subObjectIDs = uploadProcess.SubObjectIds;
            FileStorage.API.Object.Header.Types.Attribute[] attributes = new FileStorage.API.Object.Header.Types.Attribute[] {
                               new FileStorage.API.Object.Header.Types.Attribute() { Key = FileStorage.API.Object.Header.Types.Attribute.AttributeFileName, Value = fileName },
                               new FileStorage.API.Object.Header.Types.Attribute() { Key = FileStorage.API.Object.Header.Types.Attribute.AttributeTimestamp, Value = timeStamp }
                        };
            var taskCounts = 10;
            var tasks = new Task[taskCounts];
            for (int index = 0; index < taskCounts; index++)
            {
                var threadIndex = index;
                var task = new Task(() =>
                {
                    using var internalClient = OnCreateClientInternal(key);
                    if (internalClient is null)
                    {
                        uploadProcess.Fault(Error(ErrorCode.CreateClientFault));
                        return;
                    }
                    var internalSession = OnCreateSessionInternal(internalClient);
                    if (internalSession is null)
                    {
                        uploadProcess.Fault(Error(ErrorCode.CreateSessionFault));
                        return;
                    }
                    int i = 0;
                    while (threadIndex + i * taskCounts < subObjectIDs.Length)
                    {
                        byte[] data = OnGetFileInternal(filePath, (threadIndex + i * taskCounts) * PackSize, PackSize, FileLength);
                        var obj = OnCreateObjectInternal(cid, key, data, ObjectType.Regular, attributes);
                        //check has upload;                        
                        //var objheader = OnGetObjectHeaderInternal(internalClient, cid, obj.ObjectId, false);
                        if (subObjectIDs[threadIndex + i * taskCounts] is not null || OnPutObjectInternal(internalClient, obj, internalSession))
                        {
                            subObjectIDs[threadIndex + i * taskCounts] = obj.ObjectId;
                            Console.WriteLine($"The object put request has been submitted,ObjectID:{obj.ObjectId.String()},degree of completion:{uploadProcess.Add((ulong)obj.Header.PayloadLength)}/{FileLength}");
                        }
                        i++;
                        Thread.Sleep(500);
                    }
                });
                tasks[index] = task;
                task.Start();
            }
            Task.WaitAll(tasks);
            //check failed task
            for (int i = 0; i < subObjectIDs.Length; i++)
            {
                if (subObjectIDs[i] is null)
                {
                    Console.WriteLine("Some data upload fault.Please upload again.");
                    return Error(ErrorCode.UploadFault);
                }
            }
            //upload storagegroup object
            var obj = OnCreateStorageGroupObjectInternal(client, key, cid, subObjectIDs, attributes);
            if (OnPutObjectInternal(client, obj, session))
            {
                Interlocked.Exchange(ref uploadProcess.ObjectId, obj.ObjectId.String());    
                OnWriteFileInternal(new FileInfo(filePath).Directory.FullName+"\\" + $"{obj.ObjectId.String()}_{timeStamp}.seed", UTF8Encoding.UTF8.GetBytes($"{cid.String()}_{obj.ObjectId.String()}"));
                uploadProcess.TimeSpent = stopWatch.Elapsed;
                uploadProcess.Success();
                Console.WriteLine("File index upload successfully");
                Console.WriteLine("Upload file successfully");
                return null;
            }
            return Error(ErrorCode.UploadFault);
        }

        public WsError OnDownloadFileInternal(int taskId, ContainerID cid, string filePath, long fileLength, ECDsa key, bool cacheFlag = false)
        {
            Stopwatch stopWatch = new Stopwatch();
            stopWatch.Start();
            DirectoryInfo parentDirectory = null;
            if (!Directory.Exists(filePath)) parentDirectory = Directory.CreateDirectory(filePath);
            else parentDirectory = new DirectoryInfo(filePath);
            var childrenDirectorys = parentDirectory.GetDirectories().Where(p => p.Name == taskId.ToString()).ToList();
            DirectoryInfo workDirectory = null;
            if (childrenDirectorys.Count > 0)
            {
                workDirectory = childrenDirectorys.First();
            }
            else
            {
                workDirectory = parentDirectory.CreateSubdirectory(taskId.ToString());
            }
            var downloadrocess = TaskList[taskId];
            var taskCounts = 10;
            var tasks = new Task[taskCounts];
            for (int index = 0; index < taskCounts; index++)
            {
                var threadIndex = index;
                var task = new Task(() =>
                {
                    using var internalClient = OnCreateClientInternal(key);
                    if (internalClient is null) return;
                    int i = 0;
                    while (threadIndex + i * taskCounts < downloadrocess.SubObjectIds.Length)
                    {
                        string tempfilepath = workDirectory.FullName + "\\QS_" + downloadrocess.SubObjectIds[threadIndex + i * taskCounts].String();
                        FileInfo tempfile = new FileInfo(tempfilepath);
                        if (tempfile.Exists)
                        {
                            using FileStream tempstream = new FileStream(tempfilepath, FileMode.Open);
                            byte[] downedData = new byte[tempstream.Length];
                            tempstream.Read(downedData, 0, downedData.Length);
                            var oid = downloadrocess.SubObjectIds[threadIndex + i * taskCounts];
                            var objheader = OnGetObjectHeaderInternal(internalClient, cid, oid);
                            if (objheader is null) continue;
                            if (downedData.Sha256().SequenceEqual(objheader.PayloadChecksum.Sum.ToByteArray()))
                            {
                                Console.WriteLine($"Download subobject successfully,objectId:{oid.ToString()},degree of completion:{Interlocked.Add(ref downloadrocess.Current, (ulong)downedData.Length)}/{fileLength}");
                                continue;
                            }
                            else
                                tempfile.Delete();
                        }
                        else
                        {
                            using FileStream tempstream = new FileStream(tempfilepath, FileMode.Create, FileAccess.Write, FileShare.Write);
                            var oid = downloadrocess.SubObjectIds[threadIndex + i * taskCounts];
                            var obj = OnGetObjectInternal(internalClient, cid, oid);
                            if (obj is null) return;
                            var payload = obj.Payload.ToByteArray();
                            tempstream.Write(payload, 0, payload.Length);
                            tempstream.Flush();
                            tempstream.Close();
                            tempstream.Dispose();
                            Console.WriteLine($"Download subobject successfully,objectId:{oid.ToString()},degree of completion:{Interlocked.Add(ref downloadrocess.Current, (ulong)payload.Length)}/{fileLength}");
                        }
                        i++;
                    }
                });
                tasks[index] = task;
                task.Start();
            }
            Task.WaitAll(tasks);
            //check failed task
            List<ObjectID> Comparefiles = new List<ObjectID>();
            for (int i = 0; i < downloadrocess.SubObjectIds.Length; i++)
            {
                bool hasfile = false;
                foreach (FileInfo Tempfile in workDirectory.GetFiles())
                {
                    if (Tempfile.Name.Split('_')[1] == downloadrocess.SubObjectIds[i].String())
                    {
                        hasfile = true;
                        break;
                    }
                }
                if (hasfile == false)
                {
                    Comparefiles.Add(downloadrocess.SubObjectIds[i]);
                }
            }
            if (Comparefiles.Count > 0)
            {
                Console.WriteLine($"Some data is missing, please download again");
                return Error(ErrorCode.DownloadFault);
            }
            //write file
            string downPath = workDirectory.FullName + "\\" + downloadrocess.FileName;
            using (FileStream writestream = new FileStream(downPath, FileMode.Create, FileAccess.Write, FileShare.Write))
            {
                for (int index = 0; index < downloadrocess.SubObjectIds.Length; index++)
                {
                    string tempfilepath = workDirectory.FullName + "\\QS_" + downloadrocess.SubObjectIds[index].String();
                    FileInfo Tempfile = new FileInfo(tempfilepath);
                    using FileStream readTempStream = new FileStream(Tempfile.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    long onefileLength = Tempfile.Length;
                    byte[] buffer = new byte[Convert.ToInt32(onefileLength)];
                    readTempStream.Read(buffer, 0, Convert.ToInt32(onefileLength));
                    writestream.Write(buffer, 0, Convert.ToInt32(onefileLength));
                }
                writestream.Flush();
                writestream.Close();
                writestream.Dispose();
            }
            //delete temp file
            workDirectory.GetFiles().Where(p => p.Name != downloadrocess.FileName).ToList().ForEach(p => p.Delete());
            Console.WriteLine("Download file successfully");
            downloadrocess.TimeSpent = stopWatch.Elapsed;
            downloadrocess.Success();
            return null;
        }


        //internal function
        private Client OnCreateClientInternal(ECDsa key)
        {
            try
            {
                Client client = new Client(key, Host);
                return client;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Fs create client fault,error:{e}");
                return null;
            }
        }

        private bool OnGetBalanceInternal(Client client, ECDsa key, OwnerID oid, out FileStorage.API.Accounting.Decimal result)
        {
            OwnerID ownerID = null;
            if (oid is null) ownerID = OwnerID.FromScriptHash(key.PublicKey().PublicKeyToScriptHash());
            else ownerID = oid;
            using var source = new CancellationTokenSource();
            source.CancelAfter(10000);
            try
            {
                result = client.GetBalance(ownerID, context: source.Token).Result;
                source.Cancel();
                return result is not null;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Fs get account balance fail,error:{e}");
                result = null;
                source.Cancel();
                return false;
            }
        }

        private bool OnGetEpochInternal(Client client, out ulong epoch)
        {
            try
            {
                epoch = client.Epoch().Result;
                return true;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Fs get epoch fail,error:{e}");
                epoch = 0;
                return false;
            }
        }

        private byte[] OnGetFileInternal(string filePath, long start, int length, long totalLength)
        {
            using FileStream ServerStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 1024 * 80, true);
            byte[] buffer;
            //ServerStream.Position = start;
            ServerStream.Seek(start, SeekOrigin.Begin);
            if (totalLength - start < length)
            {
                buffer = new byte[totalLength - start];
                ServerStream.Read(buffer, 0, (int)(totalLength - start));
            }
            else
            {
                buffer = new byte[length];
                ServerStream.Read(buffer, 0, length);
            }
            return buffer;
        }

        private void OnWriteFileInternal(string filePath, byte[] data)
        {
            using (FileStream writestream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.Write))
            {
                writestream.Write(data, 0, data.Length);
                writestream.Flush();
                writestream.Close();
                writestream.Dispose();
            }
        }

        private SessionToken OnCreateSessionInternal(Client client)
        {
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            try
            {
                var session = client.CreateSession(ulong.MaxValue, context: source.Token).Result;
                return session;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Create session fail,error:{e}");
                source.Cancel();
                return null;
            }
        }

        private Neo.FileStorage.API.Object.Object OnCreateStorageGroupObjectInternal(Client client, ECDsa key, ContainerID cid, ObjectID[] oids, FileStorage.API.Object.Header.Types.Attribute[] attributes = null)
        {
            byte[] tzh = null;
            ulong size = 0;
            foreach (var oid in oids)
            {
                var oo = OnGetObjectHeaderInternal(client, cid, oid);
                if (oo is null) return null;
                if (tzh is null)
                    tzh = oo.PayloadHomomorphicHash.Sum.ToByteArray();
                else
                    tzh = TzHash.Concat(new() { tzh, oo.PayloadHomomorphicHash.Sum.ToByteArray() });
                size += oo.PayloadSize;
            }
            if (!OnGetEpochInternal(client, out var epoch)) return null;
            StorageGroup sg = new()
            {
                ValidationDataSize = size,
                ValidationHash = new()
                {
                    Type = ChecksumType.Tz,
                    Sum = ByteString.CopyFrom(tzh)
                },
                ExpirationEpoch = epoch + 100,
            };
            sg.Members.AddRange(oids);
            return OnCreateObjectInternal(cid, key, sg.ToByteArray(), ObjectType.StorageGroup, attributes);
        }

        private Neo.FileStorage.API.Object.Object OnCreateObjectInternal(ContainerID cid, ECDsa key, byte[] data, ObjectType objectType, FileStorage.API.Object.Header.Types.Attribute[] attributes = null)
        {
            var obj = new Neo.FileStorage.API.Object.Object
            {
                Header = new FileStorage.API.Object.Header
                {
                    Version = Neo.FileStorage.API.Refs.Version.SDKVersion(),
                    OwnerId = OwnerID.FromScriptHash(key.PublicKey().PublicKeyToScriptHash()),
                    ContainerId = cid,
                    ObjectType = objectType,
                    PayloadHash = new Checksum
                    {
                        Type = ChecksumType.Sha256,
                        Sum = ByteString.CopyFrom(data.Sha256()),
                    },
                    HomomorphicHash = new Checksum
                    {
                        Type = ChecksumType.Tz,
                        Sum = ByteString.CopyFrom(new TzHash().ComputeHash(data)),
                    },
                    PayloadLength = (ulong)data.Length,
                },
                Payload = ByteString.CopyFrom(data),
            };
            if (attributes is not null) obj.Header.Attributes.AddRange(attributes);
            obj.ObjectId = obj.CalculateID();
            obj.Signature = obj.CalculateIDSignature(key);
            return obj;
        }

        private Neo.FileStorage.API.Object.Object OnGetObjectHeaderInternal(Client client, ContainerID cid, ObjectID oid, bool logFlag = true)
        {
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            try
            {
                var objheader = client.GetObjectHeader(new Address()
                {
                    ContainerId = cid,
                    ObjectId = oid
                }, options: new CallOptions { Ttl = 2 }, context: source.Token).Result;
                source.Cancel();
                return objheader;
            }
            catch (Exception e)
            {
                if (logFlag) Console.WriteLine($"Get object header fail,objectId:{oid.ToString()},error:{e}");
                source.Cancel();
                return null;
            }
        }

        private Neo.FileStorage.API.Object.Object OnGetObjectInternal(Client client, ContainerID cid, ObjectID oid)
        {
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            try
            {
                var obj = client.GetObject(new Address()
                {
                    ContainerId = cid,
                    ObjectId = oid
                }, options: new CallOptions { Ttl = 2 }, context: source.Token).Result;
                source.Cancel();
                return obj;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Get object fail,objectId:{oid.ToString()},error:{e}");
                source.Cancel();
                return null;
            }
        }

        private bool OnPutObjectInternal(Client client, Neo.FileStorage.API.Object.Object obj, SessionToken session = null)
        {
            if (session is null)
                session = OnCreateSessionInternal(client);
            if (session is null) return false;
            using var source = new CancellationTokenSource();
            source.CancelAfter(TimeSpan.FromMinutes(1));
            try
            {
                var o = client.PutObject(obj, new CallOptions { Ttl = 2, Session = session }, source.Token).Result;
                source.Cancel();
                return true;
            }
            catch (Exception e)
            {
                Console.WriteLine($"Object put fail, errot:{e}");
                source.Cancel();
                return false;
            }
        }

        //internal check
        private bool NoWallet()
        {
            if (CurrentWallet != null) return false;
            Console.WriteLine("You have to open the wallet first.");
            return true;
        }

        private WsError CheckAndParseAccount(string paccount, out UInt160 account, out ECDsa key)
        {
            account = null;
            key = null;
            if (NoWallet()) return Error(ErrorCode.WalletNotOpen);
            try
            {
                account = paccount is null ? CurrentWallet.GetAccounts().Where(p => !p.WatchOnly).ToArray()[0].ScriptHash : paccount.ToScriptHash();
            }
            catch (Exception e)
            {
                Console.WriteLine($"Account format error:{e}");
                return Error(ErrorCode.InvalidPara);
            }
            if (!CurrentWallet.Contains(account))
            {
                Console.WriteLine("The specified account does not exist");
                return Error(ErrorCode.AddressNotFound);
            }
            if (CurrentWallet.GetAccount(account).WatchOnly)
            {
                Console.WriteLine("The specified account can not be WatchOnly");
                return Error(ErrorCode.AddressNotFoundPrivateKey);
            }
            key = CurrentWallet.GetAccount(account).GetKey().Export().LoadWif();
            return null;
        }

        private ContainerID ParseContainerID(string containerId, out WsError error)
        {
            ContainerID cid = null;
            error = null;
            try
            {
                cid = ContainerID.FromString(containerId);
            }
            catch
            {
                error = Error(ErrorCode.InvalidPara);
            }
            return cid;
        }

        private ObjectID ParseObjectID(string objectId, out WsError error)
        {
            ObjectID oid = null;
            error = null;
            try
            {
                oid = ObjectID.FromString(objectId);
            }
            catch
            {
                error = Error(ErrorCode.InvalidPara);
            }
            return oid;
        }

        private Cryptography.ECC.ECPoint ParseEcpoint(string account, out WsError error)
        {
            Cryptography.ECC.ECPoint pk = null;
            error = null;
            try
            {
                pk = Cryptography.ECC.ECPoint.Parse(account, Cryptography.ECC.ECCurve.Secp256r1);
            }
            catch
            {
                error = Error(ErrorCode.InvalidPara);
            }
            return pk;
        }

        private class Process
        {
            public int TaskId;
            public int Tasktype;
            public string ContainerId;
            public string ObjectId;
            public string FileName;
            public string FilePath;
            public string TimeStamp;
            public ulong Current;
            public ulong Total;
            public int Flag;
            public WsError Error;
            public ObjectID[] SubObjectIds;
            public TimeSpan TimeSpent;

            public Process(int taskId, int tasktype, string cid, string oid, string fileName, string filePath, ulong total, string timestamp, long count)
            {
                TaskId = taskId;
                Tasktype = tasktype;
                ContainerId = cid;
                ObjectId = oid;
                FileName = fileName;
                FilePath = filePath;
                Current = 0;
                Total = total;
                TimeStamp = timestamp;
                SubObjectIds = new ObjectID[count];
            }

            public void Rest()
            {
                Current = 0;
                Flag = 0;
                Error = null;
            }

            public ulong Add(ulong completed)
            {
                return Interlocked.Add(ref Current, completed);
            }

            public void Success()
            {
                Interlocked.Exchange(ref Flag, 1);
            }

            public void Fault(WsError error)
            {
                Interlocked.Exchange(ref Flag, -1);
                this.Error = error;
            }

            public JObject ToJson()
            {
                return new JObject
                {
                    ["taskId"] = TaskId,
                    ["tasktype"] = Tasktype,
                    ["containerId"] = ContainerId,
                    ["objectId"] = ObjectId,
                    ["fileName"] = FileName,
                    ["filePath"] = FilePath,
                    ["timeStamp"] = TimeStamp,
                    ["current"] = Current,
                    ["total"] = Total,
                    ["flag"] = Flag,
                    ["error"] = Error?.Message,
                    ["finish"] = TimeSpent.ToString()
                };
            }
        }
    }
}
