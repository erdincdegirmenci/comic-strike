using System.Reflection;

namespace ComicStrike.Server;

public static class GameInfo
{
    public const string Name = "ComicStrike";

    public static string Version { get; } =
        typeof(GameInfo).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0]
        ?? "0.0.0";
}

public static class CommandLine
{
    public static int GetInt(string[] args, string name, int fallback)
    {
        var i = Array.IndexOf(args, name);
        return i >= 0 && i + 1 < args.Length && int.TryParse(args[i + 1], out var v) && v is > 0 and < 65536 ? v : fallback;
    }
}
