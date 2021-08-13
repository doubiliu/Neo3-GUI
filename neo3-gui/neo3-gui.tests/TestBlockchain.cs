using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Neo;
using Neo.Common.Consoles;
using Neo.Ledger;

namespace neo3_gui.tests
{
    public static class TestBlockchain
    {
        public static readonly NeoSystem TheNeoSystem;

        static TestBlockchain()
        {
            Console.WriteLine("initialize NeoSystem");
            TheNeoSystem = new NeoSystem(CliSettings.Default.Protocol);

            // Ensure that blockchain is loaded

            //var _ = Blockchain.;
        }

        public static void InitializeMockNeoSystem()
        {
        }
    }
}
