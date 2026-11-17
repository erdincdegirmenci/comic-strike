using System.Diagnostics;
using System.Text;
using ComicStrike.Server;

// ComicStrike oyun sunucusu.
// Çalıştırma seçenekleri:
//   ComicStrike.exe                  → 5000 portunda başlar, tarayıcıyı açar
//   ComicStrike.exe --port 5050      → farklı port
//   ComicStrike.exe --no-browser     → tarayıcıyı otomatik açma

Console.OutputEncoding = Encoding.UTF8;

var port = CommandLine.GetInt(args, "--port", 5000);
var openBrowser = !args.Contains("--no-browser");

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://0.0.0.0:{port}"); // 0.0.0.0 = aynı ağdaki diğer bilgisayarlar da bağlanabilir
builder.Logging.SetMinimumLevel(LogLevel.Warning); // konsolu sade tut

var app = builder.Build();
var gameFiles = EmbeddedGameFiles.Load();

app.Use(gameFiles.Handle);
app.MapGet("/api/health", () => new
{
    ok = true,
    name = GameInfo.Name,
    version = GameInfo.Version,
    players = 0,
});

app.Lifetime.ApplicationStarted.Register(() =>
{
    Banner.Print(port, gameFiles.Count);
    if (openBrowser && OperatingSystem.IsWindows())
    {
        try
        {
            Process.Start(new ProcessStartInfo($"http://localhost:{port}") { UseShellExecute = true });
        }
        catch
        {
            // Tarayıcı açılamazsa sorun değil; adres konsolda yazıyor
        }
    }
});

try
{
    app.Run();
}
catch (IOException ex) when (ex.InnerException is System.Net.Sockets.SocketException || ex.Message.Contains("address already in use", StringComparison.OrdinalIgnoreCase))
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"\n{port} portu kullanımda. ComicStrike zaten açık olabilir.");
    Console.WriteLine($"Farklı port denemek için: ComicStrike.exe --port {port + 1}");
    Console.ResetColor();
    Console.WriteLine("\nKapatmak için bir tuşa bas...");
    if (!Console.IsInputRedirected) Console.ReadKey();
}
