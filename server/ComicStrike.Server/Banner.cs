using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace ComicStrike.Server;

/// <summary>Açılışta konsola oyun adresini ve arkadaşların bağlanacağı yerel ağ adreslerini yazar.</summary>
public static class Banner
{
    public static void Print(int port, int fileCount)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine();
        Console.WriteLine("  ╔══════════════════════════════╗");
        Console.WriteLine("  ║    C O M I C S T R I K E     ║");
        Console.WriteLine("  ╚══════════════════════════════╝");
        Console.ResetColor();
        Console.WriteLine($"  v{GameInfo.Version} — LAN sunucusu çalışıyor\n");

        Console.Write("  Bu bilgisayardan oyna:   ");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"http://localhost:{port}");
        Console.ResetColor();

        var addresses = LanAddresses();
        if (addresses.Count == 0)
        {
            Console.WriteLine("  (Yerel ağ bağlantısı bulunamadı. Wi-Fi'ya bağlı mısın?)");
        }
        else
        {
            Console.WriteLine("  Arkadaşların tarayıcısına bunu yazsın:");
            foreach (var (ip, adapter) in addresses)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.Write($"      http://{ip}:{port}");
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.WriteLine($"   ({adapter})");
                Console.ResetColor();
            }
        }

        if (fileCount == 0)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("\n  UYARI: Oyun dosyaları EXE'de yok. Önce 'npm run build' çalıştır.");
            Console.ResetColor();
        }

        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("\n  Windows Güvenlik Duvarı izin sorarsa 'Özel ağlar' için izin ver.");
        Console.WriteLine("  Sunucuyu kapatmak için bu pencerede Ctrl+C.\n");
        Console.ResetColor();
    }

    /// <summary>Çalışır durumdaki Wi-Fi/Ethernet bağdaştırıcılarının IPv4 adresleri. Ağ geçidi olanlar önce gelir.</summary>
    private static List<(string Ip, string Adapter)> LanAddresses()
    {
        var list = new List<(string Ip, string Adapter, bool HasGateway)>();
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus != OperationalStatus.Up) continue;
                if (nic.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel) continue;
                var name = nic.Name + " " + nic.Description;
                if (name.Contains("vEthernet", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("VirtualBox", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("VMware", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("WSL", StringComparison.OrdinalIgnoreCase)) continue;

                var props = nic.GetIPProperties();
                var hasGateway = props.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork && !g.Address.Equals(System.Net.IPAddress.Any));
                foreach (var ua in props.UnicastAddresses)
                {
                    if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    var ip = ua.Address.ToString();
                    if (ip.StartsWith("169.254.")) continue; // otomatik (bağlantısız) adres
                    list.Add((ip, nic.Name, hasGateway));
                }
            }
        }
        catch
        {
            // Ağ bilgisi okunamazsa sadece localhost gösterilir
        }
        return list.OrderByDescending(x => x.HasGateway).Select(x => (x.Ip, x.Adapter)).ToList();
    }
}
