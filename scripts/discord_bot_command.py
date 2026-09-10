# Discord Bot 範例指令 (可放入 rpjg-dcbot-cloud 的機器人程式中)
# 功能：管理員在 Discord 輸入 /genkey 或 !genkey 自動生成並發送 VIP 序號給顧客

import discord
from discord.ext import commands
import aiohttp

# 下載器後端網址 (若部署到雲端，請改為 Render 或雲端網址，如 https://rpjg-downloader.onrender.com)
DOWNLOADER_API = "http://localhost:3005"
MASTER_KEY = "065R.P.J.G"  # 總控管理員密鑰

async def generate_vip_key(tier: str = "VIP_MONTHLY", days: int = 30, description: str = ""):
    """呼叫下載器 API 建立新金鑰"""
    url = f"{DOWNLOADER_API}/api/admin/keys/generate"
    headers = {
        "Content-Type": "application/json",
        "x-vip-key": MASTER_KEY
    }
    payload = {
        "tier": tier,
        "days": days,
        "description": description
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("key")
            return None

# Slash Command 範例 (discord.app_commands)
# @bot.tree.command(name="genkey", description="發行 RPJG 影音下載器 VIP 啟用序號")
# @discord.app_commands.describe(member="要贈予或購買的會員", days="有效天數 (預設30天，0代表永久)")
async def genkey_slash(interaction: discord.Interaction, member: discord.Member, days: int = 30):
    # 僅限管理員執行
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ 權限不足，僅限管理員生成金鑰。", ephemeral=True)
        return

    tier = "VIP_LIFETIME" if days == 0 else "VIP_MONTHLY"
    desc = f"由 Discord 管理員 @{interaction.user.name} 核發給 @{member.name}"
    
    key_info = await generate_vip_key(tier=tier, days=days, description=desc)
    if not key_info:
        await interaction.response.send_message("❌ 生成金鑰失敗，請檢查下載器伺服器是否正常運行。", ephemeral=True)
        return

    key_str = key_info["key"]

    # 1. 回覆管理員
    await interaction.response.send_message(
        f"✅ 已成功為 {member.mention} 生成金鑰！\n"
        f"🔑 **序號**：`{key_str}`\n"
        f"⏳ **天數**：{'永久無限' if days == 0 else f'{days} 天'}",
        ephemeral=True
    )

    # 2. 自動發送私訊 (DM) 給購買會員
    try:
        embed = discord.Embed(
            title="🎉 感謝購買 RPJG 影音下載器 VIP 高級版！",
            description="您已獲得專屬 VIP 啟用金鑰，請前往下載器兌換解鎖永久無限制極速下載特權！",
            color=0xF59E0B
        )
        embed.add_field(name="您的專屬金鑰", value=f"```{key_str}```", inline=False)
        embed.add_field(name="下載器入口", value="[點擊進入 RPJG 下載器](http://localhost:3005)", inline=False)
        embed.add_field(name="兌換步驟", value="進入網站 -> 點擊右上角金鑰圖示 -> 輸入金鑰並按兌換即可立即生效！", inline=False)
        embed.set_footer(text="R.P.J.G 開發部門 • 感謝您的支持")
        await member.send(embed=embed)
    except Exception:
        pass
