# 第三方声明

本项目是非官方社区项目。

- “酷安”、Coolapk、酷安 Logo、社区表情及相关标识归各自权利人所有。本项目仅为识别并兼容相关服务而引用这些内容。
- 用户生成的文字和图片归各自作者所有，仅在应用运行时从服务端获取，不属于本仓库 MIT 许可证的授权内容。
- 项目通过 `@fortawesome/fontawesome-free` 软件包内置 Font Awesome Free，并遵循其字体、样式和代码的相应开源许可证，详见 <https://fontawesome.com/license/free>。
- 协议兼容代码面向未公开的酷安接口，可能随服务端调整而失效。本仓库不授予绕过访问控制或平台规则的任何权利。

本仓库中的 MIT 许可证仅适用于项目原创代码，不授予第三方名称、商标、图形或服务内容的相关权利。

## 数盟 DUID 协议参考

`src-tauri/src/coolapk/shuzilm.rs` 的协议常量和编解码流程参考 [kongwufang/szlm_res](https://github.com/kongwufang/szlm_res) 的 `tools/getduid.py`（MIT）。本项目使用最小合成请求，不包含上游测试设备的指纹模板；未使用 c001apk_next 的取号服务或包签名。

```text
MIT License

Copyright (c) 2026 kongwufang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
